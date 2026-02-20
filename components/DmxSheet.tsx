
import React from 'react';
import { UniverseData, FixtureInstance, FixtureType } from '../types';

interface DmxSheetProps {
  universe: UniverseData;
  fixtures: FixtureInstance[];
  types: FixtureType[];
  selectedFixtureId?: string | null;
  onCellClick?: (address: number) => void;
}

const DmxSheet: React.FC<DmxSheetProps> = ({ universe, fixtures, types, selectedFixtureId, onCellClick }) => {
  const cells = Array.from({ length: 512 }, (_, i) => i + 1);

  const getFixtureByAddress = (address: number) => {
    const instanceId = universe.occupied[address - 1];
    if (!instanceId) return null;
    return fixtures.find(f => f.id === instanceId);
  };

  const selectedFixture = selectedFixtureId ? fixtures.find(f => f.id === selectedFixtureId) : null;

  return (
    <div className="bg-[#111] p-3 sm:p-4 rounded-lg border border-slate-800 overflow-hidden flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-yellow-500">Universo {universe.number}</h2>
          <div className="px-2 py-0.5 bg-slate-800 rounded text-[9px] text-slate-400 font-mono uppercase tracking-wider border border-slate-700 hidden xs:block">
            DMX Sheet
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
          {universe.occupied.filter(Boolean).length} / 512 <span className="hidden sm:inline">Canais</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto min-h-0 min-w-0 pr-1">
        <div className="grid grid-cols-10 xs:grid-cols-16 sm:grid-cols-24 md:grid-cols-32 gap-0.5 sm:gap-1 content-start pb-4">
          {cells.map(addr => {
            const fixture = getFixtureByAddress(addr);
            const isSelected = fixture && fixture.id === selectedFixtureId;
            const isSameType = fixture && selectedFixture && fixture.typeId === selectedFixture.typeId && !isSelected;
            const type = fixture ? types.find(t => t.id === fixture.typeId) : null;
            
            let displayValue = addr.toString();
            if (fixture && type) {
              const startAddr = fixture.address;
              const endAddr = fixture.address + type.channels - 1;
              if (addr !== startAddr && addr !== endAddr) {
                displayValue = ""; 
              }
            }
            
            // Cor especial para montagem fixa (Red 500 style)
            const baseColor = fixture?.isFixed ? '#ef4444' : (fixture?.color || undefined);
            const borderColor = fixture?.isFixed ? '#f87171' : (fixture ? `${fixture.color}99` : undefined);
            
            return (
              <div
                key={addr}
                onClick={() => onCellClick?.(addr)}
                style={{ 
                  backgroundColor: fixture ? (isSelected ? undefined : baseColor) : undefined,
                  borderColor: fixture ? (isSelected ? undefined : borderColor) : undefined
                }}
                className={`
                  aspect-square flex items-center justify-center text-[7px] xs:text-[8px] sm:text-[9px] cursor-pointer transition-all duration-300 border
                  ${fixture 
                    ? isSelected
                      ? 'bg-yellow-500 border-white text-black font-black z-10 scale-110 shadow-[0_0_15px_rgba(234,179,8,0.7)] ring-1 ring-yellow-400 animate-fixture-select'
                      : isSameType
                        ? 'text-white font-bold opacity-100 scale-105 border-white/50 brightness-125'
                        : 'text-white font-bold hover:brightness-125 border-white/20'
                    : 'bg-slate-900 border-slate-800 text-slate-600 hover:bg-slate-800 hover:border-slate-600'}
                  rounded-[1px]
                `}
                title={fixture ? `${fixture.name} (FID: ${fixture.fid}) ${fixture.isFixed ? '[FIXO]' : ''} - Canal DMX ${addr}` : `Endereço Livre: ${addr}`}
              >
                {displayValue}
              </div>
            );
          })}
        </div>
      </div>

      {selectedFixtureId && (
        <div className="mt-3 p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black text-[10px] sm:text-xs shrink-0">
              FID {fixtures.find(f => f.id === selectedFixtureId)?.fid}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <div className="text-[8px] sm:text-[10px] font-bold text-yellow-500 uppercase tracking-widest truncate">Identificado</div>
                {fixtures.find(f => f.id === selectedFixtureId)?.isFixed && (
                  <span className="text-[8px] px-1 bg-red-500 text-white font-bold rounded">FIXO</span>
                )}
              </div>
              <div className={`text-xs sm:text-sm font-bold truncate ${fixtures.find(f => f.id === selectedFixtureId)?.isFixed ? 'text-red-500' : 'text-slate-200'}`}>
                {fixtures.find(f => f.id === selectedFixtureId)?.name}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <div className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase">Patch</div>
            <div className="text-xs sm:text-sm font-mono text-blue-400">
              {fixtures.find(f => f.id === selectedFixtureId)?.universe}.{fixtures.find(f => f.id === selectedFixtureId)?.address}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
        @media (min-width: 400px) { .grid-cols-16 { grid-template-columns: repeat(16, minmax(0, 1fr)); } }
        @media (min-width: 640px) { .grid-cols-24 { grid-template-columns: repeat(24, minmax(0, 1fr)); } }
        @media (min-width: 768px) { .grid-cols-32 { grid-template-columns: repeat(32, minmax(0, 1fr)); } }
        
        @keyframes fixture-select {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); box-shadow: 0 0 20px rgba(234,179,8,0.8); }
          100% { transform: scale(1.1); }
        }
        .animate-fixture-select {
          animation: fixture-select 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
};

export default DmxSheet;
