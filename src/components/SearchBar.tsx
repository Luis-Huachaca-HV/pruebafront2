//SEARCHBAR IMPORTANTE
import React, { useState } from "react";
import { Search as SearchIcon, MapPin, Calendar } from "lucide-react";
import MapboxLocationPicker from "@/components/MapboxLocationPicker";
import AddressAutocomplete from "@/components/AddressAutocomplete";


interface LocationValue {
    display: string;
    coords?: [number, number];
}

interface SearchBarProps {
    onSearch: (filters: {
        origin: LocationValue;
        destination: LocationValue;
        date: string;
        time: string;
        seats: number;
    }) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
    const [origin, setOrigin] = useState<LocationValue>({ display: '', coords: undefined });
    const [destination, setDestination] = useState<LocationValue>({ display: '', coords: undefined });
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [seats] = useState(1);
    const [originMapOpen, setOriginMapOpen] = useState(false);
    const [destinationMapOpen, setDestinationMapOpen] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onSearch({
            origin,
            destination,
            date,
            time,
            seats
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full max-w-full bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row lg:flex-nowrap gap-3 sm:gap-4 items-stretch lg:items-end border-2 sm:border-4 border-[#dac9df]"
        >
            {/* ORIGIN */}
            <div className="w-full lg:flex-1 lg:min-w-[220px]">
                <label className="text-sm font-bold text-[#81638b] flex items-center gap-2 mb-1">
                    <MapPin size={16} />
                    Origen
                </label>
                <div className="flex gap-2">
                    <AddressAutocomplete
                        value={origin.display}
                        onChange={(val) => setOrigin(val)}
                        placeholder="Lugar de salida"
                        className="w-full"
                        inputClassName="w-full p-3 sm:p-4 border border-[#dac9df] rounded-2xl focus:border-[#81638b]"
                    />
                    <button type="button"
                        onClick={() => setOriginMapOpen(true)}
                        className="h-12 w-12 sm:h-auto sm:w-auto sm:p-4 shrink-0 bg-[#5dc1b9] text-white rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center">
                        <MapPin size={18} />
                    </button>
                </div>
                {originMapOpen && (
                    <MapboxLocationPicker
                        defaultOpen
                        hideTrigger
                        value={origin.display}
                        placeholder="Selecciona origen"
                        icon="origin"
                        onClose={() => setOriginMapOpen(false)}
                        onChange={(loc, coords) => {
                            setOrigin({ display: loc, coords });
                            setOriginMapOpen(false);
                        }}
                    />
                )}
            </div>

            {/* DESTINATION */}
            <div className="w-full lg:flex-1 lg:min-w-[220px]">
                <label className="text-sm font-bold text-[#81638b] flex items-center gap-2 mb-1">
                    <MapPin size={16} />
                    Destino
                </label>
                <div className="flex gap-2">
                    <AddressAutocomplete
                        value={destination.display}
                        onChange={(val) => setDestination(val)}
                        placeholder="Lugar de destino"
                        className="w-full"
                        inputClassName="w-full p-3 sm:p-4 border border-[#dac9df] rounded-2xl focus:border-[#81638b]"
                    />
                    <button type="button"
                        onClick={() => setDestinationMapOpen(true)}
                        className="h-12 w-12 sm:h-auto sm:w-auto sm:p-4 shrink-0 bg-[#81638b] text-white rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center">
                        <MapPin size={18} />
                    </button>
                </div>
                {destinationMapOpen && (
                    <MapboxLocationPicker
                        defaultOpen
                        hideTrigger
                        value={destination.display}
                        placeholder="Selecciona destino"
                        icon="destination"
                        onClose={() => setDestinationMapOpen(false)}
                        onChange={(loc, coords) => {
                            setDestination({ display: loc, coords });
                            setDestinationMapOpen(false);
                        }}
                    />
                )}
            </div>

            {/* DATE */}
            <div className="w-full lg:w-44">
                <label className="text-sm font-bold text-[#81638b] flex items-center gap-2 mb-1">
                    <Calendar size={16} />
                    Fecha
                </label>
                <input
                    type="date"
                    className="w-full p-3 sm:p-4 border border-[#dac9df] rounded-2xl outline-none focus:border-[#81638b]"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>

            {/* SUBMIT BUTTON */}
            <button
                type="submit"
                className="w-full sm:w-auto bg-[#5dc1b9] text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4ab0a8] transition-colors h-12 sm:h-[58px]"
            //className="bg-red-600 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 hover:bg-[#4ab0a8] transition-colors h-[58px]"//(ROJO )
            >
                <SearchIcon size={18} />
                Buscar
            </button>
        </form>
    );

};

//console.log("¡AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!");
export default SearchBar;