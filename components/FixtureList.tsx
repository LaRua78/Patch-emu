
import React, { useState, useMemo } from 'react';
import { FixtureInstance, FixtureType } from '../types';
import { Trash2, Edit3, MapPin, CheckSquare, Square, ListChecks, Search, ArrowUp, ArrowDown, X, Anchor, Building2 } from 'lucide-react';

interface FixtureListProps {
  fixtures: FixtureInstance[];
  types: FixtureType[];
  onDelete: (fixture: FixtureInstance) => void;
  onEdit: (fixture: FixtureInstance) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
  onBulkEdit: (sortedFixtures: FixtureInstance[]) => void;
  onBulkDelete: () => void;
  theme?: 'dark' | 'light';
  showName?: string;
}

type SortKey = 'fid' | 'name' | 'type' | 'patch' | 'location';
type SortDirection = 'asc' | 'desc';

const FixtureList: React.FC<FixtureListProps> = ({ 
  fixtures, 
  types, 
  onDelete, 
  onEdit, 
  selectedIds, 
  onToggleSelection, 
  onToggleAll,
  onBulkEdit,
  onBulkDelete,
  theme = 'dark',
  showName = 'Fixture Sheet'
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('patch');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const isDark = theme === 'dark';

  const getFixtureTypeData = (typeId: string) => {
    return types.find(t => t.id === typeId);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedFixtures = useMemo(() => {
    let result = [...fixtures];

    // 1. Filtragem
    if (filterText.trim()) {
      const search = filterText.toLowerCase();
      result = result.filter(f => {
        const type = getFixtureTypeData(f.typeId);
        return (
          f.name.toLowerCase().includes(search) ||
          f.fid.toString().includes(search) ||
          f.location.toLowerCase().includes(search) ||
          type?.manufacturer.toLowerCase().includes(search) ||
          type?.name.toLowerCase().includes(search) ||
          `${f.universe}.${f.address}`.includes(search)
        );
      });
    }

    // 2. Ordenação
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'fid':
          comparison = a.fid - b.fid;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          const typeA = getFixtureTypeData(a.typeId);
          const typeB = getFixtureTypeData(b.typeId);
          comparison = (typeA?.name || '').localeCompare(typeB?.name || '');
          break;
        case 'location':
          comparison = (a.location || '').localeCompare(b.location || '');
          break;
        case 'patch':
          if (a.universe !== b.universe) {
            comparison = a.universe - b.universe;
          } else {
            comparison = a.address - b.address;
          }
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [fixtures, filterText, sortKey, sortDirection, types]);

  const allSelected = fixtures.length > 0 && selectedIds.size === fixtures.length;

  const SortIndicator = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <div className="w-4" />;
    return sortDirection === 'asc' ? <ArrowUp size={12} className="text-yellow-500" /> : <ArrowDown size={12} className="text-yellow-500" />;
  };

  const isGA = showName === 'Grande Auditório';

  return (
    <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-transparent' : 'border-slate-300 bg-white'} overflow-hidden flex flex-col h-full shadow-inner relative`}>
      {/* Toolbar / Search Area */}
      <div className={`p-3 sm:p-4 ${isDark ? 'bg-slate-900/40 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'} space-y-3 shrink-0`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex flex-col shrink-0 min-w-0">
               <div className="flex items-center gap-2">
                 {isGA && <Building2 size={16} className="text-blue-500 shrink-0" />}
                 <h2 className={`text-lg font-black tracking-tight truncate ${isGA ? 'text-blue-500' : (isDark ? 'text-slate-200 opacity-80' : 'text-slate-900')}`}>
                   {showName}
                 </h2>
               </div>
               {!isGA && <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fixture Sheet</span>}
               {isGA && <span className={`text-[10px] font-black uppercase tracking-widest text-blue-500/50`}>Instalação Fixa</span>}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-[10px] font-black uppercase bg-yellow-500 text-black px-2 py-0.5 rounded-full whitespace-nowrap">
                  {selectedIds.size} Selecionados
                </span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => onBulkEdit(filteredAndSortedFixtures)}
                    className="p-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded transition-all flex items-center gap-1.5 text-xs font-bold px-2"
                    title="Editar aparelhos selecionados na ordem visual atual"
                  >
                    <ListChecks size={14} /> <span className="hidden xs:inline">Editar Massa</span>
                  </button>
                  <button 
                    onClick={onBulkDelete}
                    className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all flex items-center gap-1.5 text-xs font-bold px-2"
                  >
                    <Trash2 size={14} /> <span className="hidden xs:inline">Apagar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative group max-w-sm w-full">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${filterText ? 'text-yellow-500' : 'text-slate-500'}`}>
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Filtrar por nome, FID, patch ou local..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className={`w-full h-9 pl-10 pr-10 text-sm rounded-lg border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-yellow-500/50' : 'bg-white border-slate-300 text-slate-900 focus:border-yellow-500'}`}
            />
            {filterText && (
              <button 
                onClick={() => setFilterText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <span className={`text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Visualizado: {filteredAndSortedFixtures.length} / {fixtures.length}</span>
           {filterText && <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-bold text-yellow-600 uppercase">Filtro Ativo</span>}
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm border-collapse table-fixed md:table-auto">
          <thead className={`sticky top-0 ${isDark ? 'bg-slate-800/90' : 'bg-slate-100/90'} backdrop-blur-md z-10 border-b ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
            <tr className={`text-[10px] sm:text-xs uppercase tracking-wider font-black ${isDark ? 'text-slate-400 opacity-80' : 'text-slate-700'}`}>
              <th className="p-3 w-10">
                <button onClick={onToggleAll} className="p-1 hover:text-yellow-500 transition-colors">
                  {allSelected ? <CheckSquare size={18} className="text-yellow-500" /> : <Square size={18} />}
                </button>
              </th>
              <th className="p-3 cursor-pointer hover:text-yellow-500 transition-colors w-14 sm:w-16" onClick={() => handleSort('fid')}>
                <div className="flex items-center gap-1">FID <SortIndicator k="fid" /></div>
              </th>
              <th className="p-3 cursor-pointer hover:text-yellow-500 transition-colors" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">Nome <SortIndicator k="name" /></div>
              </th>
              <th className="p-3 cursor-pointer hover:text-yellow-500 transition-colors hidden sm:table-cell" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-1">Tipo <SortIndicator k="type" /></div>
              </th>
              <th className="p-3 cursor-pointer hover:text-yellow-500 transition-colors w-20 sm:w-auto" onClick={() => handleSort('patch')}>
                <div className="flex items-center gap-1">Patch <SortIndicator k="patch" /></div>
              </th>
              <th className="p-3 cursor-pointer hover:text-yellow-500 transition-colors hidden md:table-cell" onClick={() => handleSort('location')}>
                <div className="flex items-center gap-1">Localização <SortIndicator k="location" /></div>
              </th>
              <th className="p-3 w-16 sm:w-20">Ações</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredAndSortedFixtures.length === 0 ? (
              <tr>
                <td colSpan={7} className={`p-12 text-center italic font-medium ${isDark ? 'text-slate-500 opacity-40' : 'text-slate-400'}`}>Nenhum fixture encontrado com os critérios atuais.</td>
              </tr>
            ) : (
              filteredAndSortedFixtures.map(f => {
                const typeData = getFixtureTypeData(f.typeId);
                const isSelected = selectedIds.has(f.id);
                return (
                  <tr 
                    key={f.id} 
                    className={`transition-colors group ${isSelected ? (isDark ? 'bg-yellow-500/10' : 'bg-yellow-500/5') : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                  >
                    <td className="p-3">
                      <button onClick={() => onToggleSelection(f.id)} className="p-1 transition-colors">
                        {isSelected ? <CheckSquare size={18} className="text-yellow-500" /> : <Square size={18} className="opacity-30 group-hover:opacity-100" />}
                      </button>
                    </td>
                    <td className="p-3 text-yellow-500 font-mono font-bold">{f.fid}</td>
                    <td className="p-3">
                      <div className="flex flex-col min-w-0">
                        <div className={`font-semibold truncate flex items-center gap-2 ${f.isFixed ? 'text-red-500' : (isDark ? 'text-slate-200' : 'text-slate-900')}`}>
                          {f.isFixed && <Anchor size={12} className="shrink-0 text-red-500/60" />}
                          <span className="truncate">{f.name}</span>
                        </div>
                        {/* Mobile Location Badge */}
                        <div className={`md:hidden flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'} text-[9px] font-bold uppercase tracking-tight truncate`}>
                          <MapPin size={8} className="shrink-0" />
                          <span className="truncate">{f.location || 'Sem Local'}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`p-3 hidden sm:table-cell ${isDark ? 'text-slate-300 opacity-80' : 'text-slate-700 font-medium'} truncate`}>
                      {typeData?.name || 'Unknown'}
                      <span className="block text-[10px] opacity-60 italic">{typeData?.mode || '-'}</span>
                    </td>
                    <td className="p-3 text-blue-500 font-mono font-bold whitespace-nowrap">{f.universe}.{f.address}</td>
                    <td className={`p-3 hidden md:table-cell font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs truncate`}>
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="opacity-50 shrink-0" />
                        <span className="truncate">{f.location || '-'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button 
                          onClick={() => onEdit(f)}
                          className={`p-1.5 rounded transition-all ${isDark ? 'text-yellow-500/70 hover:bg-yellow-500 hover:text-black' : 'text-yellow-600 hover:bg-yellow-500 hover:text-white'}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => onDelete(f)}
                          className={`p-1.5 rounded transition-all ${isDark ? 'text-red-500/70 hover:bg-red-500 hover:text-white' : 'text-red-600 hover:bg-red-500 hover:text-white'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FixtureList;
