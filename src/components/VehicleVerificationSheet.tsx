import React, { useState } from 'react';
import { X, Car, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export interface VehicleData {
  brand: string;
  model: string;
  color: string;
  year: string;
  plate: string;
  seats: string;
  uploadMode?: 'split' | 'combined';
  licenseFile?: File | null;
  soatFile?: File | null;
  propertyCardFile?: File | null;
  technicalReviewFile?: File | null;
  combinedFile?: File | null;
}

export type VehicleStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface VehicleVerificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleSubmitted: (vehicle: VehicleData) => Promise<void> | void;
  currentVehicle?: VehicleData | null;
  status: VehicleStatus;
  isLoading?: boolean;
}

const CAR_BRANDS = [
  'Toyota', 'Suzuki', 'Honda', 'Nissan', 'Mazda', 'Ford',
  'Chevrolet', 'Hyundai', 'Kia', 'Volkswagen', 'BMW', 'Mercedes-Benz',
  'Renault', 'Peugeot', 'Fiat', 'Mitsubishi', 'Subaru', 'Jeep'
];

const CAR_COLORS = [
  { name: 'Blanco', value: 'blanco' },
  { name: 'Negro', value: 'negro' },
  { name: 'Gris', value: 'gris' },
  { name: 'Rojo', value: 'rojo' },
  { name: 'Azul', value: 'azul' },
  { name: 'Verde', value: 'verde' },
  { name: 'Amarillo', value: 'amarillo' },
  { name: 'Plateado', value: 'plateado' },
  { name: 'Dorado', value: 'dorado' },
  { name: 'Marrón', value: 'marron' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => (CURRENT_YEAR - i).toString());

const SEAT_OPTIONS = ['2', '3', '4', '5', '6', '7', '8'];

const VehicleVerificationSheet: React.FC<VehicleVerificationSheetProps> = ({
  open,
  onOpenChange,
  onVehicleSubmitted,
  currentVehicle,
  status,
  isLoading = false,
}) => {
  const { toast } = useToast();
  const [brand, setBrand] = useState(currentVehicle?.brand || '');
  const [model, setModel] = useState(currentVehicle?.model || '');
  const [color, setColor] = useState(currentVehicle?.color || '');
  const [year, setYear] = useState(currentVehicle?.year || '');
  const [plate, setPlate] = useState(currentVehicle?.plate || '');
  const [seats, setSeats] = useState(currentVehicle?.seats || '');

  const [uploadMode, setUploadMode] = useState<'split' | 'combined'>(currentVehicle?.uploadMode || 'split');
  const [licenseFile, setLicenseFile] = useState<File | null>(currentVehicle?.licenseFile || null);
  const [soatFile, setSoatFile] = useState<File | null>(currentVehicle?.soatFile || null);
  const [propertyCardFile, setPropertyCardFile] = useState<File | null>(currentVehicle?.propertyCardFile || null);
  const [technicalReviewFile, setTechnicalReviewFile] = useState<File | null>(currentVehicle?.technicalReviewFile || null);
  const [combinedFile, setCombinedFile] = useState<File | null>(currentVehicle?.combinedFile || null);
  const [combinedConfirmed, setCombinedConfirmed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when currentVehicle changes
  React.useEffect(() => {
    if (currentVehicle) {
      setBrand(currentVehicle.brand || '');
      setModel(currentVehicle.model || '');
      setColor(currentVehicle.color || '');
      setYear(currentVehicle.year || '');
      setPlate(currentVehicle.plate || '');
      setSeats(currentVehicle.seats || '');
      setLicenseFile(currentVehicle.licenseFile || null);
      setSoatFile(currentVehicle.soatFile || null);
      setPropertyCardFile(currentVehicle.propertyCardFile || null);
      setTechnicalReviewFile(currentVehicle.technicalReviewFile || null);
      setUploadMode(currentVehicle.uploadMode || 'split');
      setCombinedFile(currentVehicle.combinedFile || null);
    }
  }, [currentVehicle]);

  const handleSubmit = async () => {
    // Basic vehicle validation
    if (!brand || !model || !color || !year || !plate || !seats) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos del vehículo",
        variant: "destructive",
      });
      return;
    }

    // Documents validation (Required if not previously verified or pending)
    if (status === 'none' || status === 'rejected') {
      if (uploadMode === 'split' && (!licenseFile || !soatFile || !propertyCardFile)) {
        toast({
          title: "Documentos incompletos",
          description: "Licencia de conducir, SOAT y tarjeta de propiedad son obligatorios en modo individual",
          variant: "destructive",
        });
        return;
      }
      if (uploadMode === 'combined' && (!combinedFile || !combinedConfirmed)) {
        toast({
          title: "Documentos incompletos",
          description: "Debes adjuntar el archivo único y marcar la casilla de confirmación",
          variant: "destructive",
        });
        return;
      }
    }

    const vehicleData: VehicleData = {
      brand,
      model,
      color,
      year,
      plate: plate.toUpperCase(),
      seats,
      uploadMode,
      licenseFile,
      soatFile,
      propertyCardFile,
      technicalReviewFile,
      combinedFile,
    };

    setIsSubmitting(true);
    try {
      await onVehicleSubmitted(vehicleData);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBaseComplete = brand && model && color && year && plate && seats;
  const isSplitComplete = licenseFile && soatFile && propertyCardFile;
  const isCombinedComplete = combinedFile && combinedConfirmed;

  const isFormComplete = isBaseComplete && ((status !== 'none' && status !== 'rejected') || (uploadMode === 'split' ? isSplitComplete : isCombinedComplete));
  const isFormDisabled = status === 'pending' || status === 'verified';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-display">Mi Vehículo y Documentos</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] px-1">
          {status === 'pending' && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Verificación en proceso</p>
                <p className="text-xs text-muted-foreground">Tu vehículo está siendo verificado, esto puede tomar unos días.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b border-border pb-2">Datos del Vehículo</h3>
            {/* Brand */}
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={brand} onValueChange={setBrand} disabled={isFormDisabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una marca" />
                </SelectTrigger>
                <SelectContent>
                  {CAR_BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                placeholder="Ej: Corolla, Civic, Spark"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isFormDisabled}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor} disabled={isFormDisabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un color" />
                </SelectTrigger>
                <SelectContent>
                  {CAR_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={year} onValueChange={setYear} disabled={isFormDisabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el año" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plate */}
            <div className="space-y-2">
              <Label>Placa</Label>
              <Input
                placeholder="Ej: ABC-123"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                maxLength={10}
                disabled={isFormDisabled}
              />
            </div>

            {/* Seats */}
            <div className="space-y-2">
              <Label>Cantidad de asientos</Label>
              <Select value={seats} onValueChange={setSeats} disabled={isFormDisabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cantidad" />
                </SelectTrigger>
                <SelectContent>
                  {SEAT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s} asientos</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="font-semibold text-lg border-b border-border pb-2">Documentos Requeridos</h3>
            <p className="text-xs text-muted-foreground pb-2">
              Sube fotos o PDFs claros para poder validar tu cuenta como conductor.
            </p>

            {!isFormDisabled && (
              <div className="flex gap-4 mb-4">
                <Button
                  type="button"
                  variant={uploadMode === 'split' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('split')}
                  className="flex-1"
                >
                  Individuales
                </Button>
                <Button
                  type="button"
                  variant={uploadMode === 'combined' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('combined')}
                  className="flex-1"
                >
                  Un Solo PDF
                </Button>
              </div>
            )}

            {uploadMode === 'split' ? (
              <>
                <div className="space-y-2">
                  <Label>Licencia de Conducir <span className="text-red-500">*</span></Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>SOAT (Vigente) <span className="text-red-500">*</span></Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setSoatFile(e.target.files?.[0] || null)}
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tarjeta de Propiedad <span className="text-red-500">*</span></Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPropertyCardFile(e.target.files?.[0] || null)}
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Revisión Técnica <span className="text-muted-foreground font-normal">(Obligatorio si auto {'>'} 3 años)</span></Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setTechnicalReviewFile(e.target.files?.[0] || null)}
                    disabled={isFormDisabled}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Archivo Combinado (PDF) <span className="text-red-500">*</span></Label>
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setCombinedFile(e.target.files?.[0] || null)}
                    disabled={isFormDisabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sube un único archivo con todos tus documentos requeridos (Licencia, SOAT, Tarjeta de Propiedad, y Revisión si aplica).
                  </p>
                </div>

                <div className="flex items-start gap-3 mt-4 bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      id="combined-confirmation"
                      className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      checked={combinedConfirmed}
                      onChange={(e) => setCombinedConfirmed(e.target.checked)}
                      disabled={isFormDisabled}
                    />
                  </div>
                  <Label htmlFor="combined-confirmation" className="text-sm font-medium leading-tight cursor-pointer">
                    Estoy seguro de que este archivo incluye mi SOAT vigente, Licencia, Tarjeta de Propiedad y Revisión Técnica (solo si mi auto tiene más de 3 años de antigüedad).
                  </Label>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          {status === 'verified' ? (
            <div className="text-center text-muted-foreground py-2">
              Tu vehículo y documentos están verificados ✓
            </div>
          ) : status === 'pending' ? (
            <div className="text-center text-muted-foreground py-2">
              Esperando aprobación del administrador...
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={!isFormComplete || isSubmitting || isLoading}
            >
              <Car className="w-5 h-5 mr-2" />
              {isSubmitting ? 'Registrando...' : currentVehicle ? 'Actualizar información' : 'Subir y Registrar'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VehicleVerificationSheet;
