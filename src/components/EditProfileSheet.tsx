import React, { useState } from 'react';
import { Camera, User, Eye, EyeOff, Lock, Mail, Phone, ImageIcon, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { updateCurrentUser, changePassword } from '@/services/users';
import { uploadProfilePhoto, base64ToFile } from '@/services/profilePhoto';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentEmail: string;
  currentPhone: string;
  currentDescription: string;
  currentPhotoUrl: string | null;
  onSave: (data: { name: string; email: string; phone: string; description: string; photoUrl: string | null }) => void;
}

const EditProfileSheet: React.FC<EditProfileSheetProps> = ({
  open,
  onOpenChange,
  currentName,
  currentEmail,
  currentPhone,
  currentDescription,
  currentPhotoUrl,
  onSave,
}) => {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone);
  const [description, setDescription] = useState(currentDescription);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, accessToken, updateUser, isGoogleUser } = useAuth();

  // Password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const passwordValidations = {
    minLength: newPassword.trim().length >= 10,
    hasUpperCase: /[A-Z]/.test(newPassword.trim()),
    hasLowerCase: /[a-z]/.test(newPassword.trim()),
    hasNumber: /[0-9]/.test(newPassword.trim()),
    hasSpace: /\s/.test(newPassword.trim()),
    noTrailingSpace: !newPassword.trim().endsWith(' '),
    isDifferent: newPassword.trim() !== currentPassword.trim(),
  };

  React.useEffect(() => {
    if (newPassword.trim().length === 0) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    const len = newPassword.trim().length;

    if (len >= 10 && len < 15) {
      strength = 30; // Débil
    } else if (len >= 15 && len < 20) {
      strength = 60; // Fuerte
    } else if (len >= 20) {
      strength = 80; // Muy Fuerte
    }

    if (len >= 15) {
      if (passwordValidations.hasUpperCase) strength += 5;
      if (passwordValidations.hasLowerCase) strength += 5;
      if (passwordValidations.hasNumber) strength += 5;
      if (passwordValidations.hasSpace) strength += 5;
    }

    setPasswordStrength(Math.min(strength, 100));
  }, [newPassword, passwordValidations]);

  const getPasswordStrengthColor = () => {
    const len = newPassword.trim().length;
    if (len === 0) return 'bg-secondary';
    if (len >= 10 && len < 15) return 'bg-red-500';
    if (len >= 15 && len < 20) return 'bg-blue-500';
    if (len >= 20) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getPasswordStrengthText = () => {
    const len = newPassword.trim().length;
    if (len === 0) return '';
    if (len >= 10 && len < 15) return 'Débil';
    if (len >= 15 && len < 20) return 'Fuerte';
    if (len >= 20) return 'Muy Fuerte';
    return 'Débil';
  };

  const isPasswordValid = passwordValidations.minLength &&
    passwordValidations.hasUpperCase &&
    passwordValidations.hasLowerCase &&
    passwordValidations.hasNumber &&
    passwordValidations.noTrailingSpace &&
    passwordValidations.isDifferent;

  // Reset state when sheet opens
  React.useEffect(() => {
    if (open) {
      setName(currentName);
      setEmail(currentEmail);
      setPhone(currentPhone);
      setDescription(currentDescription);
      setPhotoUrl(currentPhotoUrl);
      setShowPasswordSection(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, currentName, currentEmail, currentPhone, currentDescription, currentPhotoUrl]);

  const isNative = Capacitor.isNativePlatform();

  const uploadPhoto = async (file: File) => {
    if (!user?.id || !accessToken) {
      toast({ title: 'Error', description: 'Debes iniciar sesión para subir una foto', variant: 'destructive' });
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(file, user.id, accessToken);
      setPhotoUrl(url);
      updateUser({ avatar: url });
      toast({ title: '¡Foto actualizada!', description: 'Tu foto de perfil ha sido actualizada' });
    } catch (error: any) {
      toast({ title: 'Error al subir la foto', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoFromGallery = () => {
    if (isNative) {
      handleNativeCamera('PHOTOS');
    } else {
      fileInputRef.current?.click();
    }
  };

  const handlePhotoFromCamera = () => {
    if (isNative) {
      handleNativeCamera('CAMERA');
    } else {
      // Web fallback: open file picker with capture attribute
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) await uploadPhoto(file);
      };
      input.click();
    }
  };

  const handleNativeCamera = async (source: 'CAMERA' | 'PHOTOS') => {
    try {
      const { Camera: CapCamera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      const image = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'CAMERA' ? CameraSource.Camera : CameraSource.Photos,
      });

      if (image.dataUrl) {
        const file = base64ToFile(image.dataUrl, `avatar_${Date.now()}.jpg`);
        await uploadPhoto(file);
      }
    } catch (error: any) {
      if (error?.message !== 'User cancelled photos app') {
        toast({ title: 'Error', description: error?.message || 'No se pudo acceder a la cámara', variant: 'destructive' });
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Por favor selecciona una imagen válida', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no debe superar los 5MB', variant: 'destructive' });
      return;
    }
    await uploadPhoto(file);
    // Reset input
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos requeridos', variant: 'destructive' });
      return;
    }

    if (name.trim().length < 3) {
      toast({ title: 'Error', description: 'El nombre debe tener al menos 3 caracteres', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: 'Error', description: 'Por favor, ingresa un correo electrónico válido', variant: 'destructive' });
      return;
    }

    let cleanPhone = phone.trim().replace(/\s+/g, '');
    if (cleanPhone) {
      if (!cleanPhone.startsWith('+51')) {
        cleanPhone = '+51' + cleanPhone.replace(/^\+?/, '');
      }
      if (!/^\+51[0-9]{9}$/.test(cleanPhone)) {
        toast({ title: 'Error', description: 'Por favor, ingresa un celular válido (debe tener exactamente 9 números)', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    try {
      const updateData: Record<string, string> = {};
      if (name.trim() !== currentName) updateData.full_name = name.trim();
      if (email.trim() !== currentEmail) updateData.email = email.trim();
      if (cleanPhone !== currentPhone.replace(/\s+/g, '')) updateData.phone_number = cleanPhone;
      if (description.trim() !== currentDescription) updateData.description = description.trim();
      if (photoUrl !== currentPhotoUrl) updateData.avatar_url = photoUrl || '';

      if (Object.keys(updateData).length > 0) {
        await updateCurrentUser(updateData);
      }

      onSave({
        name: name.trim(),
        email: email.trim(),
        phone: cleanPhone,
        description: description.trim(),
        photoUrl,
      });

      onOpenChange(false);
      toast({ title: 'Perfil actualizado', description: 'Tus cambios han sido guardados' });
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.message || 'No se pudieron guardar los cambios',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();

    if (!trimmedCurrentPassword) {
      toast({ title: 'Error', description: 'Ingresa tu contraseña actual', variant: 'destructive' });
      return;
    }
    if (trimmedNewPassword.length < 10) {
      toast({ title: 'Error', description: 'La nueva contraseña debe tener al menos 10 caracteres', variant: 'destructive' });
      return;
    }
    if (trimmedNewPassword !== confirmPassword.trim()) {
      toast({ title: 'Error', description: 'Las contraseñas nuevas no coinciden', variant: 'destructive' });
      return;
    }
    if (trimmedCurrentPassword === trimmedNewPassword) {
      toast({ title: 'Error', description: 'La nueva contraseña no puede ser la misma que la actual', variant: 'destructive' });
      return;
    }

    // Additional validations exactly like register
    if (!/[A-Z]/.test(trimmedNewPassword)) {
      toast({ title: 'Error', description: 'La contraseña debe contener al menos una mayúscula', variant: 'destructive' });
      return;
    }
    if (!/[a-z]/.test(trimmedNewPassword)) {
      toast({ title: 'Error', description: 'La contraseña debe contener al menos una minúscula', variant: 'destructive' });
      return;
    }
    if (!/[0-9]/.test(trimmedNewPassword)) {
      toast({ title: 'Error', description: 'La contraseña debe contener al menos un número', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(trimmedCurrentPassword, trimmedNewPassword);
      toast({ title: 'Contraseña actualizada', description: 'Tu contraseña ha sido cambiada exitosamente' });
      setShowPasswordSection(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = () => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-display">Editar Perfil</SheetTitle>
          <SheetDescription>
            Actualiza tu información personal
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {/* Photo Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-24 h-24 shadow-lg">
                {photoUrl ? (
                  <AvatarImage src={photoUrl} alt="Foto de perfil" />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    getInitials() || <User className="w-10 h-10" />
                  )}
                </AvatarFallback>
              </Avatar>
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Photo action buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePhotoFromCamera}
                disabled={isUploadingPhoto}
                className="flex items-center gap-1.5 text-xs"
              >
                <Camera className="w-4 h-4" />
                {isNative ? 'Cámara' : 'Tomar foto'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePhotoFromGallery}
                disabled={isUploadingPhoto}
                className="flex items-center gap-1.5 text-xs"
              >
                <ImageIcon className="w-4 h-4" />
                {isNative ? 'Galería' : 'Subir imagen'}
              </Button>
            </div>

            {/* Hidden file input for web gallery */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {isUploadingPhoto && (
              <p className="text-xs text-muted-foreground animate-pulse">Subiendo foto...</p>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" /> Nombre completo
            </Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                // Permitir solo letras (incluyendo acentos y ñ) y espacios
                const filteredValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                // Prevenir espacios contiguos
                setName(filteredValue.replace(/\s{2,}/g, ' '));
              }}
              placeholder="Tu nombre completo"
              maxLength={100}
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Correo electrónico
            </Label>
            <Input
              id="email"
              name="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" /> Celular
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">+51</span>
              <Input
                id="phone"
                name="phone"
                autoComplete="tel"
                type="tel"
                value={(phone || '').replace(/^\+51/, '').trim()}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 9) {
                    setPhone('+51 ' + val);
                  }
                }}
                className="pl-10"
                placeholder="999 999 999"
              />
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuéntanos sobre ti..."
              className="min-h-[80px] resize-none rounded-xl border-2 border-input focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {(description || '').length}/200
            </p>
          </div>

          {/* Save Profile Button */}
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim() || isUploadingPhoto}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Guardando...' : 'Guardar cambios'}
          </Button>

          {/* Password section: hidden for Google users */}
          {!isGoogleUser && (
            <>
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Lock className="w-4 h-4" />
                  {showPasswordSection ? 'Cancelar cambio de contraseña' : 'Cambiar contraseña'}
                </button>
              </div>
            </>
          )}

          {/* Password Section */}
          {!isGoogleUser && showPasswordSection && (
            <div className="space-y-4 bg-muted/50 rounded-xl p-4 animate-in slide-in-from-top-2">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Contraseña actual</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    autoComplete="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Medidor de fortaleza */}
                {newPassword.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mt-2 px-2 py-2 rounded-xl bg-orange-100/40">
                      <span className="text-xs font-medium text-slate-700">
                        Fortaleza: {getPasswordStrengthText()}
                      </span>
                      {/* Indicador visual */}
                      <div className="flex items-center justify-between mt-2 px-2 py-2 rounded-xl w-1/2">
                        <div className={`h-2 rounded-full transition-all duration-300 w-full ${getPasswordStrengthColor()}`} style={{ width: `${passwordStrength}%` }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Checks de validación */}
                {newPassword.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {!passwordValidations.minLength && (
                      <div className="flex items-center gap-2 text-xs">
                        <X className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Mínimo 10 caracteres ({newPassword.trim().length}/10)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      {passwordValidations.hasUpperCase ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-slate-500" />}
                      <span className={passwordValidations.hasUpperCase ? 'text-green-500' : 'text-slate-500'}>Al menos una mayúscula</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {passwordValidations.hasLowerCase ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-slate-500" />}
                      <span className={passwordValidations.hasLowerCase ? 'text-green-500' : 'text-slate-500'}>Al menos una minúscula</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {passwordValidations.hasNumber ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-slate-500" />}
                      <span className={passwordValidations.hasNumber ? 'text-green-500' : 'text-slate-500'}>Al menos un número</span>
                    </div>
                    {currentPassword.trim() && !passwordValidations.isDifferent && (
                      <div className="flex items-center gap-2 text-xs">
                        <X className="w-4 h-4 text-red-500" />
                        <span className="text-red-500">Debe ser diferente a la actual</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}

              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                variant="secondary"
                className="w-full"
              >
                {isChangingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditProfileSheet;
