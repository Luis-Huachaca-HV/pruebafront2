import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import BrandHeader from '@/components/BrandHeader';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Validaciones de nombre
  const nameValidations = {
    minLength: name.trim().length >= 8,
    onlyLettersAndSpaces: /^[a-zA-Z\s]*$/.test(name),
    noConsecutiveSpaces: !/\s{2,}/.test(name),
    noTrailingSpace: !name.endsWith(' '),
  };

  const isNameValid = nameValidations.minLength &&
    nameValidations.onlyLettersAndSpaces &&
    nameValidations.noConsecutiveSpaces &&
    nameValidations.noTrailingSpace;

  // Validaciones de email
  const emailValidations = {
    hasAt: email.includes('@'),
    hasDomain: email.includes('@') && email.split('@')[1]?.length > 0,
    hasDotInDomain: email.includes('@') && email.split('@')[1]?.includes('.'),
    hasValidTLD: email.includes('@') && (() => {
      const domain = email.split('@')[1];
      if (!domain) return false;
      const parts = domain.split('.');
      return parts.length >= 2 && parts[parts.length - 1]?.length >= 2;
    })(),
    validLocalPart: email.includes('@') && (() => {
      const localPart = email.split('@')[0];
      if (!localPart) return false;
      // Solo letras, dígitos, guiones, puntos y guiones bajos
      const validChars = /^[a-zA-Z0-9._-]+$/.test(localPart);
      // No espacios
      const noSpaces = !localPart.includes(' ');
      // No caracteres especiales consecutivos
      const noConsecutive = !localPart.includes('..') && !localPart.includes('__') && !localPart.includes('--');
      // No empezar/terminar con punto
      const noStartEndDot = !localPart.startsWith('.') && !localPart.endsWith('.');
      return validChars && noSpaces && noConsecutive && noStartEndDot;
    })(),
    validDomain: email.includes('@') && (() => {
      const domain = email.split('@')[1];
      if (!domain) return false;
      // Solo letras, dígitos, guiones y puntos
      const validChars = /^[a-zA-Z0-9.-]+$/.test(domain);
      // No caracteres especiales consecutivos
      const noConsecutive = !domain.includes('..') && !domain.includes('--');
      // No empezar/terminar con punto o guión
      const noStartEndSpecial = !domain.startsWith('.') && !domain.endsWith('.') &&
        !domain.startsWith('-') && !domain.endsWith('-');
      return validChars && noConsecutive && noStartEndSpecial;
    })(),
  };

  const isEmailValid = email.length === 0 || (
    emailValidations.hasAt &&
    emailValidations.hasDomain &&
    emailValidations.hasDotInDomain &&
    emailValidations.hasValidTLD &&
    emailValidations.validLocalPart &&
    emailValidations.validDomain
  );

  // Handler para el nombre que filtra caracteres no permitidos
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Solo permitir letras y espacios
    value = value.replace(/[^a-zA-Z\s]/g, '');

    // Prevenir espacios contiguos
    value = value.replace(/\s{2,}/g, ' ');

    setName(value);
  };

  // Validaciones de contraseña
  const passwordValidations = {
    minLength: password.length >= 10,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpace: /\s/.test(password), // Permitir espacios
    noTrailingSpace: !password.endsWith(' '),
  };

  // Calcular fortaleza de contraseña
  // Débil: 10-14 caracteres (mínimo)
  // Fuerte: 15-19 caracteres
  // Muy Fuerte: 20+ caracteres
  useEffect(() => {
    if (password.length === 0) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;

    // Base por longitud (principal factor)
    if (password.length >= 10 && password.length < 15) {
      strength = 30; // Débil
    } else if (password.length >= 15 && password.length < 20) {
      strength = 60; // Fuerte
    } else if (password.length >= 20) {
      strength = 80; // Muy Fuerte (base)
    }

    // Bonificaciones por diversidad de caracteres (solo si ya tiene buena longitud)
    if (password.length >= 15) {
      if (passwordValidations.hasUpperCase) strength += 5;
      if (passwordValidations.hasLowerCase) strength += 5;
      if (passwordValidations.hasNumber) strength += 5;
      if (passwordValidations.hasSpace) strength += 5;
    }

    setPasswordStrength(Math.min(strength, 100));
  }, [password, passwordValidations]);

  // Verificar si el formulario es válido
  const isPasswordValid = passwordValidations.minLength &&
    passwordValidations.hasUpperCase &&
    passwordValidations.hasLowerCase &&
    passwordValidations.hasNumber &&
    passwordValidations.noTrailingSpace;

  const isFormValid = isNameValid &&
    isEmailValid &&
    isPasswordValid &&
    password === confirmPassword &&
    confirmPassword.length > 0 &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length > 0;

  /*
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      value = value.replace(/[^a-zA-Z\s]/g, '');
      value = value.replace(/\s{2,}/g, ' ');
      setName(value);
    };
  */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que los campos no estén vacíos (solo espacios)
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({
        title: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (!isNameValid) {
      if (name.trim().length < 8) {
        toast({
          title: "El nombre debe tener al menos 8 caracteres",
          variant: "destructive",
        });
      } else if (!nameValidations.onlyLettersAndSpaces) {
        toast({
          title: "El nombre solo puede contener letras y espacios",
          variant: "destructive",
        });
      } else if (!nameValidations.noConsecutiveSpaces) {
        toast({
          title: "El nombre no puede tener espacios contiguos",
          variant: "destructive",
        });
      }
      return;
    }

    if (!isEmailValid) {
      toast({
        title: "El correo electrónico debe tener un dominio válido (ej: gmail.com)",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    if (!passwordValidations.minLength) {
      toast({
        title: "La contraseña debe tener al menos 10 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!passwordValidations.hasUpperCase) {
      toast({
        title: "La contraseña debe contener al menos una mayúscula",
        variant: "destructive",
      });
      return;
    }

    if (!passwordValidations.hasLowerCase) {
      toast({
        title: "La contraseña debe contener al menos una minúscula",
        variant: "destructive",
      });
      return;
    }

    if (!passwordValidations.hasNumber) {
      toast({
        title: "La contraseña debe contener al menos un número",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Eliminar espacios al final antes de enviar
    const result = await register(name.trimEnd(), email.trim(), password.trimEnd());

    if (result.success) {
      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido creada exitosamente",
      });
      navigate('/search');
    } else {
      toast({
        title: result.error || "No se pudo crear la cuenta",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const getPasswordStrengthColor = () => {
    if (password.length === 0) return 'bg-secondary';
    if (password.length >= 10 && password.length < 15) return 'bg-red-500'; // Débil
    if (password.length >= 15 && password.length < 20) return 'bg-blue-500'; // Fuerte
    if (password.length >= 20) return 'bg-green-500'; // Muy Fuerte
    return 'bg-red-500';
  };

  const getPasswordStrengthText = () => {
    if (password.length === 0) return '';
    if (password.length >= 10 && password.length < 15) return 'Débil';
    if (password.length >= 15 && password.length < 20) return 'Fuerte';
    if (password.length >= 20) return 'Muy Fuerte';
    return 'Débil';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <BrandHeader subtitle="Comparte el viaje" className="mb-8" />

      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Crear Cuenta</h2>
          <p className="text-slate-400 text-sm mt-1">Únete a la comunidad</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-bottom-6 duration-700">

          {/* Nombre Completo */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 ml-1">Nombre completo</label>
            <div className="relative">
              {/*<User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /> */}
              <Input
                type="text"
                placeholder="Mínimo 8 caracteres (solo letras y espacios)"
                value={name}
                onChange={handleNameChange}
                required
                minLength={8}
                className={`transition-all duration-200 focus:scale-[1.01] focus:shadow-md ${name.length > 0 && !isNameValid
                  ? 'border-[#81638b]'
                  : name.length > 0 && isNameValid
                    ? 'border-[#5dc1b9]'
                    : ''
                  }`}
              />
              {name.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isNameValid ? (
                    <Check className="w-5 h-5 text-[#5dc1b9] animate-in zoom-in-50 duration-200" />
                  ) : (
                    <X className="w-5 h-5 text-[#81638b] opacity-80 animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              )}
            </div>

            {/* Validaciones del nombre - Solo aparecen cuando se está escribiendo */}
            {name.length > 0 && (
              <div className="space-y-1 mt-2">
                {/* Solo mostrar contador si no se ha alcanzado el mínimo */}
                {!nameValidations.minLength && (
                  <div className="flex items-center gap-2 text-xs">
                    <X className="w-4 h-4 text-[#81638b]" />
                    <span className="text-[#81638b]">
                      Mínimo 8 caracteres ({name.trim().length}/8)
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {nameValidations.onlyLettersAndSpaces ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={nameValidations.onlyLettersAndSpaces ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Solo letras y espacios
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {nameValidations.noTrailingSpace ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={nameValidations.noTrailingSpace ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Sin espacios al final
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground ml-1">Correo electrónico</label>
            <div className="relative">
              <Input
                name="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={
                  email.length > 0 && !isEmailValid
                    ? 'border-[#81638b] pr-12'
                    : email.length > 0 && isEmailValid
                      ? 'border-[#5dc1b9] pr-12'
                      : ''
                }
              />
              {email.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {!isEmailValid ? (
                    <X className="w-5 h-5 text-[#81638b] opacity-80 animate-in zoom-in-50 duration-200" />
                  ) : (
                    <Check className="w-5 h-5 text-[#5dc1b9] animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Contraseña</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 10 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                maxLength={64}
                className={`transition-all duration-200 focus:scale-[1.01] focus:shadow-md ${password.length > 0 && !isPasswordValid
                  ? 'border-[#81638b] pr-24'
                  : password.length > 0 && isPasswordValid
                    ? 'border-[#5dc1b9] pr-24'
                    : 'pr-24'
                  }`}
              />
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                {password.length > 0 &&
                  (isPasswordValid ? (
                    <Check className="w-5 h-5 text-[#5dc1b9] animate-in zoom-in-50 duration-200" />
                  ) : (
                    <X className="w-5 h-5 text-[#81638b] opacity-80 animate-in zoom-in-50 duration-200" />
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Medidor de fortaleza */}
            {password.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Fortaleza:</span>
                  <span className={`font-medium ${password.length >= 10 && password.length < 15 ? 'text-[#81638b]' : password.length >= 15 && password.length < 20 ? 'text-blue-500' : password.length >= 20 ? 'text-[#5dc1b9]' : 'text-[#81638b]'}`}>
                    {getPasswordStrengthText()}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 px-2 py-2 rounded-xl bg-[#dac9df]/40">
                  <span className="text-xs font-medium text-[#81638b]">
                    Fortaleza: {getPasswordStrengthText()}
                  </span>
                  {/* Indicador visual */}
                  <div className="flex items-center gap-1">
                    {[20, 40, 60, 80].map((level, index) => (
                      <span
                        key={index}
                        className={`transition-all duration-300 ${passwordStrength >= level
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-20 translate-y-1'
                          }`}
                        style={{ transitionDelay: `${index * 100}ms` }}
                      >
                        🚗
                      </span>
                    ))}
                  </div>
                  <div className={`flex items-center justify-between mt-2 px-2 py-2 rounded-xl 
                    ${passwordStrength < 40 ? 'bg-[#81638b]/20' : passwordStrength < 70 ? 'bg-[#b695c0]/20' : 'bg-[#5dc1b9]/20'}`}>
                    <div className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`} style={{ width: `${passwordStrength}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Checks de validación - Solo aparecen cuando se está escribiendo */}
            {password.length > 0 && (
              <div className="space-y-1 mt-2">
                {/* Solo mostrar contador si no se ha alcanzado el mínimo */}
                {!passwordValidations.minLength && (
                  <div className="flex items-center gap-2 text-xs">
                    <X className="w-4 h-4 text-[#81638b]" />
                    <span className="text-[#81638b]">
                      Mínimo 10 caracteres ({password.length}/10)
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidations.hasUpperCase ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={passwordValidations.hasUpperCase ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Al menos una mayúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidations.hasLowerCase ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={passwordValidations.hasLowerCase ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Al menos una minúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidations.hasNumber ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={passwordValidations.hasNumber ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Al menos un número
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Check className="w-4 h-4 text-[#5dc1b9]" />
                  <span className="text-[#5dc1b9]">
                    Espacios permitidos
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidations.noTrailingSpace ? (
                    <Check className="w-4 h-4 text-[#5dc1b9]" />
                  ) : (
                    <X className="w-4 h-4 text-[#81638b]" />
                  )}
                  <span className={passwordValidations.noTrailingSpace ? 'text-[#5dc1b9]' : 'text-[#81638b]'}>
                    Sin espacios al final
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirmar contraseña</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`transition-all duration-200 focus:scale-[1.01] focus:shadow-md ${confirmPassword.length > 0 && password !== confirmPassword
                  ? 'border-[#81638b] pr-12'
                  : confirmPassword.length > 0 && password === confirmPassword
                    ? 'border-[#5dc1b9] pr-12'
                    : ''
                  }`}
              />
              {confirmPassword.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {password === confirmPassword ? (
                    <Check className="w-5 h-5 text-[#5dc1b9] animate-in zoom-in-50 duration-200" />
                  ) : (
                    <X className="w-5 h-5 text-[#81638b] opacity-80 animate-in zoom-in-50 duration-200" />
                  )}
                </div>
              )}
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-[#81638b]">
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full mt-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
            size="lg"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creando cuenta...
              </span>
            ) : 'Crear Cuenta'}
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center animate-in fade-in duration-500">
          <p className="text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
