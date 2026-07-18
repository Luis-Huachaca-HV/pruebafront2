import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Mail, Car, LogOut, Phone, CheckCircle2, XCircle, Clock, Pencil, BadgeCheck, User, Wallet, ShieldCheck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsDriver, useCanCreateTrips } from '@/hooks/use-user-role';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import PhoneVerificationSheet from '@/components/PhoneVerificationSheet';
import VehicleVerificationSheet, { VehicleData, VehicleStatus } from '@/components/VehicleVerificationSheet';
import EditProfileSheet from '@/components/EditProfileSheet';
import { getMyVehicles, createVehicle, VehicleResponse } from '@/services/vehicles';
import { uploadDocumentFile, createDocumentRecord } from '@/services/documents';
import { getMyWallet } from '@/services/walletService';
import { getUserProfile, UserReviewSummary } from '@/services/users';

const Profile: React.FC = () => {
  const { user, accessToken, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isDriver = useIsDriver();
  const { canCreate: canCreateTrips } = useCanCreateTrips();

  // Profile edit state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileDescription, setProfileDescription] = useState(user?.description || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(user?.avatar || null);
  const [profileName, setProfileName] = useState(user?.full_name || '');

  // Phone verification state
  const [isPhoneSheetOpen, setIsPhoneSheetOpen] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(user?.phone_number || null);

  // Keep local display state in sync with the global AuthContext user data
  useEffect(() => {
    if (user?.avatar) setProfilePhotoUrl(user.avatar);
  }, [user?.avatar]);

  useEffect(() => {
    if (user?.full_name) setProfileName(user.full_name);
  }, [user?.full_name]);

  useEffect(() => {
    if (user?.description !== undefined) setProfileDescription(user.description);
  }, [user?.description]);

  useEffect(() => {
    if (user?.phone_number !== undefined) setVerifiedPhone(user.phone_number);
  }, [user?.phone_number]);

  // Vehicle verification state
  const [isVehicleSheetOpen, setIsVehicleSheetOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>('none');
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);

  // Wallet balance
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [recentReviews, setRecentReviews] = useState<UserReviewSummary[]>([]);

  // Load existing vehicle and wallet balance on mount
  useEffect(() => {
    const loadVehicle = async () => {
      if (!accessToken) return;

      try {
        const vehicles = await getMyVehicles(accessToken);
        if (vehicles.length > 0) {
          const v = vehicles[0];
          setVehicleData({
            brand: v.brand,
            model: v.model,
            color: v.color || '',
            year: String(v.year),
            plate: v.plate,
            seats: String(v.seat_capacity),
          });
          setVehicleStatus(v.verification_status as VehicleStatus);
        }
      } catch (error) {
        console.error('Error loading vehicle:', error);
      }
    };

    const loadWallet = async () => {
      if (!accessToken) return;
      try {
        const wallet = await getMyWallet(accessToken);
        setWalletBalance(wallet.balance);
      } catch (error) {
        console.error('Error loading wallet:', error);
      }
    };

    const loadProfileReviews = async () => {
      if (!user?.id) return;
      try {
        const profile = await getUserProfile(user.id);
        setRecentReviews(profile.recent_reviews || []);
      } catch (error) {
        console.error('Error loading profile reviews:', error);
      }
    };

    loadVehicle();
    loadWallet();
    loadProfileReviews();
  }, [accessToken, user?.id]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente",
    });
    navigate('/login');
  };

  const handlePhoneVerified = (phone: string) => {
    setVerifiedPhone(phone);
  };

  const handleVehicleSubmitted = async (vehicle: VehicleData) => {
    if (!accessToken) return;

    setIsLoadingVehicle(true);
    try {
      const vehiclePayload = {
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: parseInt(vehicle.year),
        plate: vehicle.plate.toUpperCase(),
        seat_capacity: parseInt(vehicle.seats),
      };

      const createdVehicle = await createVehicle(vehiclePayload, accessToken);

      // Upload pending documents
      const uploadDoc = async (file: File | null | undefined, docType: string) => {
        if (!file) return;
        const url = await uploadDocumentFile(file, user.id, docType, accessToken);
        await createDocumentRecord(accessToken, 'vehicle', createdVehicle.id, docType, url);
      };

      if (vehicle.uploadMode === 'combined' && vehicle.combinedFile) {
        await uploadDoc(vehicle.combinedFile, 'combined');
      } else {
        await Promise.all([
          uploadDoc(vehicle.licenseFile, 'license'),
          uploadDoc(vehicle.soatFile, 'soat'),
          uploadDoc(vehicle.propertyCardFile, 'property_card'),
          uploadDoc(vehicle.technicalReviewFile, 'technical_review')
        ]);
      }

      setVehicleData(vehicle);
      setVehicleStatus('pending');

      toast({
        title: "Vehículo registrado",
        description: "Tu vehículo está pendiente de verificación por un administrador",
      });
    } catch (error: any) {
      toast({
        title: "Error al registrar vehículo",
        description: error.message || "Ocurrió un error al registrar tu vehículo",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const getVehicleStatusIcon = () => {
    switch (vehicleStatus) {
      case 'pending':
        return <Clock className="w-6 h-6 text-muted-foreground" />;
      case 'verified':
        return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      default:
        return null;
    }
  };

  const getVehicleSubtitle = () => {
    if (!vehicleData) return 'No registrado';
    if (vehicleStatus === 'pending') return `${vehicleData.brand} ${vehicleData.model} - Pendiente`;
    if (vehicleStatus === 'verified') return `${vehicleData.brand} ${vehicleData.model} - Verificado`;
    return 'No registrado';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground">Perfil</h1>
      </div>

      {/* User Card */}
      <div className="bg-card rounded-2xl p-6 shadow-md mb-6 animate-slide-up">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20 shadow-purple">
            {profilePhotoUrl ? (
              <AvatarImage src={profilePhotoUrl} alt="Foto de perfil" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {(() => {
                const name = profileName || user?.full_name || 'U';
                if (!name || typeof name !== 'string') return 'U';
                const initials = name.split(' ').map(n => n[0] || '').join('').toUpperCase();
                return initials || 'U';
              })()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-display font-bold text-foreground">{profileName || user?.full_name || 'Usuario'}</h2>
              {isDriver && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  <Car className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Conductor</span>
                  {canCreateTrips && (
                    <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
                  )}
                </div>
              )}
              {!isDriver && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                  <User className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Pasajero</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-medium text-foreground">{user.rating ? Number(user.rating).toFixed(1) : 'Nuevo'}</span>
              <span className="text-muted-foreground">• {user.tripsCompleted || 0} viajes</span>
            </div>
            {profileDescription && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{profileDescription}</p>
            )}
            {isDriver && !canCreateTrips && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Vehículo pendiente de verificación
              </p>
            )}
          </div>
          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <Pencil className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Correo electrónico</p>
              <p className="font-medium text-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {isDriver ? 'Viajes como conductor' : 'Viajes completados'}
              </p>
              <p className="font-medium text-foreground">
                {user.total_trips_as_driver !== undefined && isDriver
                  ? `${user.total_trips_as_driver} viajes`
                  : `${user.tripsCompleted || 0} viajes`}
              </p>
            </div>
          </div>
          {!isDriver && user.total_trips_as_passenger !== undefined && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Viajes como pasajero</p>
                <p className="font-medium text-foreground">{user.total_trips_as_passenger} viajes</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calificación</p>
              <p className="font-medium text-foreground">{user.rating ? `${Number(user.rating).toFixed(1)} / 5.0` : 'Sin calificaciones'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Verification Section */}
      <button
        onClick={() => setIsPhoneSheetOpen(true)}
        className="w-full bg-card rounded-2xl p-6 shadow-md mb-4 animate-slide-up flex items-center justify-between hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-display font-bold text-foreground">Celular</h3>
            {verifiedPhone ? (
              <p className="text-sm text-muted-foreground">{verifiedPhone}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No verificado</p>
            )}
          </div>
        </div>
        {verifiedPhone ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        ) : (
          <XCircle className="w-6 h-6 text-destructive" />
        )}
      </button>

      {/* Vehicle Verification Section */}
      <button
        onClick={() => setIsVehicleSheetOpen(true)}
        className="w-full bg-card rounded-2xl p-6 shadow-md mb-6 animate-slide-up flex items-center justify-between hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-display font-bold text-foreground">Mi Vehículo</h3>
            <p className="text-sm text-muted-foreground">{getVehicleSubtitle()}</p>
          </div>
        </div>
        {getVehicleStatusIcon()}
      </button>

      {/* Wallet Section */}
      {isDriver && (
        <button
          onClick={() => navigate('/wallet')}
          className="w-full bg-card rounded-2xl p-6 shadow-md mb-4 animate-slide-up flex items-center justify-between hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-display font-bold text-foreground">Mi Billetera</h3>
              <p className="text-sm text-muted-foreground">Saldo y movimientos</p>
            </div>
          </div>
          {walletBalance !== null && (
            <div className="text-right">
              <span className="text-lg font-bold text-primary">
                S/ {Number(walletBalance).toFixed(2)}
              </span>
            </div>
          )}
        </button>
      )}

      {isDriver && (
        <div className="w-full bg-card rounded-2xl p-6 shadow-md mb-4 animate-slide-up">
          <div className="mb-4">
            <h3 className="text-lg font-display font-bold text-foreground">Calificaciones y comentarios</h3>
            <p className="text-sm text-muted-foreground">
              Opiniones recientes de los pasajeros sobre tus viajes.
            </p>
          </div>

          {recentReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes comentarios visibles.</p>
          ) : (
            <div className="space-y-4">
              {recentReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{review.reviewer_name || 'Pasajero'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {review.origin_name && review.destination_name
                          ? ` • ${review.origin_name} → ${review.destination_name}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-amber-500" />
                      <span className="font-semibold text-foreground">{review.score.toFixed(1)}</span>
                    </div>
                  </div>
                  {review.comment ? (
                    <p className="text-sm text-foreground/90 mt-3 leading-relaxed">{review.comment}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-3 italic">Sin comentario adicional.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimers visibles desde el perfil */}
      <section className="w-full bg-card rounded-2xl p-6 shadow-md mb-4 animate-slide-up" aria-labelledby="disclaimers-title">
        <div className="mb-4">
          <h3 id="disclaimers-title" className="text-lg font-display font-bold text-foreground">Descargos y condiciones</h3>
          <p className="text-sm text-muted-foreground">Información importante antes de separar un viaje.</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90"><span className="font-semibold">Seguridad:</span> verifica la identidad del conductor, el vehículo y el punto de encuentro. La plataforma facilita el contacto, pero cada usuario debe tomar sus propias precauciones.</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
            <CreditCard className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90"><span className="font-semibold">Pago anticipado:</span> para separar el viaje puede solicitarse el pago por adelantado. Revisa el monto, las condiciones de cancelación y conserva tu comprobante antes de confirmar.</p>
          </div>
        </div>
      </section>

      {/* Logout Button */}
      <div className="mt-8 animate-fade-in">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          size="lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Cerrar sesión
        </Button>
      </div>

      {/* Phone Verification Sheet */}
      <PhoneVerificationSheet
        open={isPhoneSheetOpen}
        onOpenChange={setIsPhoneSheetOpen}
        onVerified={handlePhoneVerified}
      />

      {/* Vehicle Verification Sheet */}
      <VehicleVerificationSheet
        open={isVehicleSheetOpen}
        onOpenChange={setIsVehicleSheetOpen}
        onVehicleSubmitted={handleVehicleSubmitted}
        currentVehicle={vehicleData}
        status={vehicleStatus}
        isLoading={isLoadingVehicle}
      />

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={isEditProfileOpen}
        onOpenChange={setIsEditProfileOpen}
        currentName={profileName || user?.full_name || ''}
        currentEmail={user?.email || ''}
        currentPhone={verifiedPhone || user?.phone_number || ''}
        currentDescription={profileDescription}
        currentPhotoUrl={profilePhotoUrl}
        onSave={(data) => {
          setProfileName(data.name);
          setProfileDescription(data.description);
          setProfilePhotoUrl(data.photoUrl);
          updateUser({
            avatar: data.photoUrl || undefined,
            full_name: data.name,
            email: data.email,
            description: data.description,
            phone_number: data.phone
          });
          if (data.phone) setVerifiedPhone(data.phone);
        }}
      />
    </div>
  );
};

export default Profile;
