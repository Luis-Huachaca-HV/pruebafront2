import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COUNTRY_CODES = [
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+1', country: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
];

// Simulated verification code
const SIMULATED_CODE = '123456';

interface PhoneVerificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (phone: string) => void;
}

const PhoneVerificationSheet: React.FC<PhoneVerificationSheetProps> = ({
  open,
  onOpenChange,
  onVerified,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [countryOpen, setCountryOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setStep('input');
      setPhoneNumber('');
      setVerificationCode('');
      setTimeLeft(60);
      setIsTimerActive(false);
    }
  }, [open]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerActive(false);
      toast({
        title: "Tiempo expirado",
        description: "El código ha expirado. Solicita uno nuevo.",
        variant: "destructive",
      });
      setStep('input');
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, toast]);

  const handleSendCode = () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast({
        title: "Número inválido",
        description: "Por favor ingresa un número de teléfono válido",
        variant: "destructive",
      });
      return;
    }

    // Simulate sending SMS
    toast({
      title: "Código enviado",
      description: `Se ha enviado un código SMS a ${selectedCountry.code} ${phoneNumber}. (Simulado: usa 123456)`,
    });
    
    setStep('verify');
    setTimeLeft(60);
    setIsTimerActive(true);
  };

  const handleVerifyCode = () => {
    if (verificationCode === SIMULATED_CODE) {
      const fullPhone = `${selectedCountry.code} ${phoneNumber}`;
      onVerified(fullPhone);
      toast({
        title: "¡Verificado!",
        description: "Tu número de teléfono ha sido verificado correctamente",
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Código incorrecto",
        description: "El código ingresado no es válido",
        variant: "destructive",
      });
    }
  };

  const handleResendCode = () => {
    setTimeLeft(60);
    setIsTimerActive(true);
    setVerificationCode('');
    toast({
      title: "Código reenviado",
      description: `Nuevo código enviado a ${selectedCountry.code} ${phoneNumber}. (Simulado: usa 123456)`,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-display">
            {step === 'input' ? 'Verificar número de celular' : 'Ingresa el código'}
          </SheetTitle>
          <SheetDescription>
            {step === 'input' 
              ? 'Ingresa tu número de teléfono para verificarlo'
              : `Enviamos un código SMS a ${selectedCountry.code} ${phoneNumber}`
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {step === 'input' ? (
            <>
              {/* Country Code Selector */}
              <div className="space-y-2">
                <Label>País</Label>
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={countryOpen}
                      className="w-full justify-between h-12"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xl">{selectedCountry.flag}</span>
                        <span>{selectedCountry.country}</span>
                        <span className="text-muted-foreground">({selectedCountry.code})</span>
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar país..." />
                      <CommandList>
                        <CommandEmpty>No se encontró el país.</CommandEmpty>
                        <CommandGroup>
                          {COUNTRY_CODES.map((country) => (
                            <CommandItem
                              key={country.code}
                              value={country.country}
                              onSelect={() => {
                                setSelectedCountry(country);
                                setCountryOpen(false);
                              }}
                            >
                              <span className="text-xl mr-2">{country.flag}</span>
                              <span>{country.country}</span>
                              <span className="ml-auto text-muted-foreground">{country.code}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Phone Number Input */}
              <div className="space-y-2">
                <Label htmlFor="phone">Número de teléfono</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-4 bg-muted rounded-xl text-muted-foreground min-w-[80px] justify-center">
                    {selectedCountry.code}
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="987654321"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    className="flex-1"
                  />
                </div>
              </div>

              <Button onClick={handleSendCode} className="w-full" size="lg">
                <Phone className="w-4 h-4 mr-2" />
                Enviar código SMS
              </Button>
            </>
          ) : (
            <>
              {/* Timer */}
              <div className={cn(
                "text-center text-2xl font-bold",
                timeLeft <= 10 ? "text-destructive" : "text-primary"
              )}>
                {formatTime(timeLeft)}
              </div>

              {/* Verification Code Input */}
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificación</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <Button 
                onClick={handleVerifyCode} 
                className="w-full" 
                size="lg"
                disabled={verificationCode.length !== 6}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Verificar código
              </Button>

              <Button 
                onClick={handleResendCode} 
                variant="ghost" 
                className="w-full"
                disabled={timeLeft > 0}
              >
                Reenviar código
              </Button>

              <Button 
                onClick={() => setStep('input')} 
                variant="outline" 
                className="w-full"
              >
                Cambiar número
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PhoneVerificationSheet;
