
import { 
  LayoutGrid, 
  List, 
  Plus, 
  Settings,
  Database,
  AlertCircle,
  AlertTriangle,
  Edit3,
  Check,
  Activity,
  Layers,
  Box,
  Monitor,
  Search,
  Tag,
  Cpu,
  Download,
  Upload,
  FileText,
  Moon,
  Sun,
  X,
  Trash2,
  BookOpen,
  Wrench,
  FileDown,
  Sliders,
  Info,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  MapPin,
  ListChecks,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
  Anchor,
  Building2,
  Building,
  Map,
  Home,
  Tent,
  SortAsc
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FixtureInstance, FixtureType, UniverseData, ViewMode } from './types';
import { INITIAL_FIXTURE_TYPES, PATCH_LOCATIONS, FIXED_GA_PATCH, FIXED_PA_PATCH, FIXED_BB_PATCH } from './constants';
import FixtureList from './components/FixtureList';
import DmxSheet from './components/DmxSheet';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const STORAGE_KEYS = {
  FIXTURES: 'ma3_emu_fixtures',
  FIXTURE_TYPES: 'ma3_emu_fixture_types',
  MAX_UNIVERSES: 'ma3_emu_max_universes',
  THEME: 'ma3_emu_theme',
  SIDEBAR_VISIBLE: 'ma3_emu_sidebar_visible',
  SHOW_NAME: 'ma3_emu_show_name'
};

const APP_VERSION = 'v1.9.7';

type PdfSortMode = 'fid_loc' | 'loc_fid' | 'patch_loc' | 'loc_patch' | 'fid_patch' | 'patch_fid';

const getManufacturerColor = (manufacturer: string) => {
  const colors = [
    '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', 
    '#0891b2', '#e11d48', '#65a30d', '#4f46e5', '#9333ea',
  ];
  let hash = 0;
  for (let i = 0; i < manufacturer.length; i++) {
    hash = manufacturer.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const App: React.FC = () => {
  const [fixtures, setFixtures] = useState<FixtureInstance[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FIXTURES);
    return saved ? JSON.parse(saved) : [];
  });

  const [fixtureTypes, setFixtureTypes] = useState<FixtureType[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FIXTURE_TYPES);
    return saved ? JSON.parse(saved) : INITIAL_FIXTURE_TYPES;
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_VISIBLE);
    return saved !== null ? saved === 'true' : true;
  });

  const [showName, setShowName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SHOW_NAME) || 'Novo Espetáculo';
  });

  const [maxUniverses, setMaxUniverses] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MAX_UNIVERSES);
    return saved ? parseInt(saved) : 24;
  });

  const [activeUniverse, setActiveUniverse] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('fixtureList');
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showAddManual, setShowAddManual] = useState(false);
  const [showEditManual, setShowEditManual] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHouseRigs, setShowHouseRigs] = useState(false);
  const [showFixtureEditor, setShowFixtureEditor] = useState(false);
  const [showExportPDFDialog, setShowExportPDFDialog] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetLibraryConfirm, setShowResetLibraryConfirm] = useState(false);
  const [fixtureToDelete, setFixtureToDelete] = useState<FixtureInstance | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [roomToLoad, setRoomToLoad] = useState<any | null>(null);
  
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentVisualOrder, setCurrentVisualOrder] = useState<FixtureInstance[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FIXTURES, JSON.stringify(fixtures));
    localStorage.setItem(STORAGE_KEYS.FIXTURE_TYPES, JSON.stringify(fixtureTypes));
    localStorage.setItem(STORAGE_KEYS.MAX_UNIVERSES, maxUniverses.toString());
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_VISIBLE, isSidebarVisible.toString());
    localStorage.setItem(STORAGE_KEYS.SHOW_NAME, showName);
  }, [fixtures, fixtureTypes, maxUniverses, theme, isSidebarVisible, showName]);

  const patchFileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const mobileUniScrollRef = useRef<HTMLDivElement>(null);

  const MAX_PARAMETERS = useMemo(() => maxUniverses * 512, [maxUniverses]);

  const [newFid, setNewFid] = useState<string>('1');
  const [newName, setNewName] = useState<string>('');
  const [newUniverse, setNewUniverse] = useState<string>('1');
  const [newAddress, setNewAddress] = useState<string>('1');
  const [newLocation, setNewLocation] = useState<string>(PATCH_LOCATIONS[0]);
  const [newIsFixed, setNewIsFixed] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<string>('1');
  const [useNextFree, setUseNextFree] = useState<boolean>(false);

  // PDF Export States
  const [pdfIncludeFixed, setPdfIncludeFixed] = useState(true);
  const [pdfSortMode, setPdfSortMode] = useState<PdfSortMode>('patch_loc');

  const [bulkName, setBulkName] = useState<string>('');
  const [bulkUseNamePattern, setBulkUseNamePattern] = useState(false);
  const [bulkTypeId, setBulkTypeId] = useState<string>('');
  const [bulkUniverse, setBulkUniverse] = useState<string>('');
  const [bulkAddress, setBulkAddress] = useState<string>('');
  const [bulkLocation, setBulkLocation] = useState<string>('');
  const [bulkIsFixed, setBulkIsFixed] = useState<boolean>(false);
  const [bulkFid, setBulkFid] = useState<string>('');
  const [bulkUpdateFid, setBulkUpdateFid] = useState(false);
  const [bulkUpdateType, setBulkUpdateType] = useState(false);
  const [bulkUpdatePatch, setBulkUpdatePatch] = useState(false);
  const [bulkUpdateLocation, setBulkUpdateLocation] = useState(false);
  const [bulkUpdateName, setBulkUpdateName] = useState(false);
  const [bulkUpdateIsFixed, setBulkUpdateIsFixed] = useState(false);

  const [editorManufacturer, setEditorManufacturer] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorMode, setEditorMode] = useState('Standard');
  const [editorChannels, setEditorChannels] = useState('1');

  const themeStyles = {
    dark: {
      bg: 'bg-[#0c0c0c]',
      bgElevated: 'bg-[#141414]',
      bgSidebar: 'bg-[#0f0f0f]',
      bgContent: 'bg-[#0a0a0a]',
      border: 'border-slate-800',
      text: 'text-slate-200',
      textMuted: 'text-slate-500',
      card: 'bg-slate-900/40',
      input: 'bg-slate-900 border-slate-700 text-white',
      inputFocus: 'focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20'
    },
    light: {
      bg: 'bg-[#f1f5f9]',
      bgElevated: 'bg-white',
      bgSidebar: 'bg-[#e2e8f0]',
      bgContent: 'bg-[#f8fafc]',
      border: 'border-slate-300',
      text: 'text-slate-900',
      textMuted: 'text-slate-500',
      card: 'bg-white border-slate-200 shadow-sm',
      input: 'bg-white border-slate-200 text-slate-900',
      inputFocus: 'focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 shadow-sm'
    }
  };

  const s = theme === 'dark' ? themeStyles.dark : themeStyles.light;

  const fixtureGroups = useMemo(() => {
    const groups: Record<string, FixtureType[]> = {};
    fixtureTypes.forEach(t => {
      const key = `${t.manufacturer} - ${t.name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [fixtureTypes]);

  const [selectedFixtureKey, setSelectedFixtureKey] = useState<string>(Object.keys(fixtureGroups)[0] || "");
  const [selectedModeId, setSelectedModeId] = useState<string>(fixtureGroups[selectedFixtureKey]?.[0]?.id || "");

  const getNextSequenceNumber = useCallback((typeId: string, baseName: string) => {
    const fixturesOfSameType = fixtures.filter(f => f.typeId === typeId);
    if (fixturesOfSameType.length === 0) return 1;
    let maxNum = 0;
    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedBaseName} (\\d+)$`);
    fixturesOfSameType.forEach(f => {
      const match = f.name.match(regex);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    return maxNum > 0 ? maxNum + 1 : fixturesOfSameType.length + 1;
  }, [fixtures]);

  useEffect(() => {
    if (fixtureGroups[selectedFixtureKey]) {
      const modes = fixtureGroups[selectedFixtureKey];
      const isValidMode = modes.some(m => m.id === selectedModeId);
      const currentModeId = isValidMode ? selectedModeId : modes[0]?.id;
      if (!isValidMode && modes.length > 0) setSelectedModeId(modes[0].id);
      if (currentModeId && !showEditManual) {
        const type = fixtureTypes.find(t => t.id === currentModeId);
        if (type) setNewName(type.name);
      }
    }
  }, [selectedFixtureKey, fixtureGroups, selectedModeId, showEditManual, fixtureTypes]);

  const universeData = useMemo(() => {
    const universes: Record<number, (string | null)[]> = {};
    fixtures.forEach(fixture => {
      const type = fixtureTypes.find(t => t.id === fixture.typeId);
      if (!type) return;
      if (!universes[fixture.universe]) universes[fixture.universe] = new Array(512).fill(null);
      for (let i = 0; i < type.channels; i++) {
        const addrIndex = fixture.address + i - 1;
        if (addrIndex < 512) universes[fixture.universe][addrIndex] = fixture.id;
      }
    });
    return universes;
  }, [fixtures, fixtureTypes]);

  const stats = useMemo(() => {
    const totalParams = fixtures.reduce((acc, f) => acc + (fixtureTypes.find(t => t.id === f.typeId)?.channels || 0), 0);
    const usedUniverses = new Set(fixtures.map(f => f.universe)).size;
    const currentUniOccupancy = (universeData[activeUniverse]?.filter(Boolean).length || 0);
    const currentUniPercent = Math.round((currentUniOccupancy / 512) * 100);
    return { totalFixtures: fixtures.length, totalParameters: totalParams, universesCount: usedUniverses, currentUniPercent };
  }, [fixtures, fixtureTypes, universeData, activeUniverse]);

  const findNextFreeAddress = useCallback((uni: number, totalNeededChannels: number, excludeId?: string | string[]) => {
    const occupied = universeData[uni] || new Array(512).fill(null);
    let consecutiveFree = 0; let startCandidate = 1;
    const excludes = Array.isArray(excludeId) ? new Set(excludeId) : new Set(excludeId ? [excludeId] : []);
    for (let i = 0; i < 512; i++) {
      const currentOccupant = occupied[i];
      if (!currentOccupant || excludes.has(currentOccupant)) {
        if (consecutiveFree === 0) startCandidate = i + 1;
        consecutiveFree++;
        if (consecutiveFree >= totalNeededChannels) return startCandidate;
      } else consecutiveFree = 0;
    }
    return null;
  }, [universeData]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === fixtures.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(fixtures.map(f => f.id)));
  };

  useEffect(() => {
    if (useNextFree) {
      const uni = parseInt(newUniverse); const qty = parseInt(quantity) || 1;
      const selectedType = fixtureTypes.find(t => t.id === selectedModeId);
      if (uni && selectedType) {
        const totalNeeded = showEditManual ? selectedType.channels : (qty * selectedType.channels);
        const nextFree = findNextFreeAddress(uni, totalNeeded, editingFixtureId || undefined);
        if (nextFree) { setNewAddress(nextFree.toString()); setErrorMessage(null); } 
        else {
          const minFree = findNextFreeAddress(uni, selectedType.channels, editingFixtureId || undefined);
          if (minFree) {
            setNewAddress(minFree.toString());
            if (!showEditManual && qty > 1) setErrorMessage(`Aviso: O universo ${uni} não tem espaço contínuo para ${qty} aparelhos. O patch poderá falhar.`);
          } else setErrorMessage(`Erro: O universo ${uni} está cheio ou não tem espaço para este tipo de fixture.`);
        }
      }
    }
  }, [useNextFree, newUniverse, quantity, selectedModeId, findNextFreeAddress, editingFixtureId, fixtureTypes, showEditManual]);

  const currentUniverse: UniverseData = useMemo(() => ({
    number: activeUniverse,
    occupied: universeData[activeUniverse] || new Array(512).fill(null)
  }), [activeUniverse, universeData]);

  const checkCollision = useCallback((universe: number, address: number, channels: number, excludeIds?: string | string[]) => {
    const excludes = new Set(Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []));
    for (let i = 0; i < channels; i++) {
      const targetAddr = address + i;
      if (targetAddr > 512) return `Endereço ${targetAddr} fora de alcance no Universo ${universe} (máx 512)`;
      const existingId = universeData[universe]?.[targetAddr - 1];
      if (existingId && !excludes.has(existingId)) {
        const collisionFixture = fixtures.find(f => f.id === existingId);
        return `Colisão DMX em ${universe}.${targetAddr} com ${collisionFixture?.name} (FID ${collisionFixture?.fid})`;
      }
    }
    return null;
  }, [universeData, fixtures]);

  const handleCellClick = (address: number) => {
    const occupantId = universeData[activeUniverse]?.[address - 1];
    if (occupantId) setSelectedFixtureId(occupantId === selectedFixtureId ? null : occupantId);
    else setSelectedFixtureId(null);
  };

  const handleCreateFixtureType = (e: React.FormEvent) => {
    e.preventDefault();
    const newType: FixtureType = {
      id: `custom-${Date.now()}`, manufacturer: editorManufacturer || "Custom", name: editorName || "Unknown", mode: editorMode || "Standard", channels: parseInt(editorChannels) || 1
    };
    setFixtureTypes(prev => [...prev, newType]);
    setSelectedFixtureKey(`${newType.manufacturer} - ${newType.name}`); setSelectedModeId(newType.id); setNewName(newType.name); setShowFixtureEditor(false); setShowAddManual(true);
    setEditorManufacturer(''); setEditorName(''); setEditorMode('Standard'); setEditorChannels('1');
  };

  const handleExportPatch = () => {
    const data = { type: "Patch", version: APP_VERSION, showName: showName, exportDate: new Date().toISOString(), fixtures: fixtures, config: { maxUniverses } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `patch_${new Date().getTime()}.json`;
    link.click(); URL.revokeObjectURL(url);
    setShowSettings(false);
  };

  const handleExportLibrary = () => {
    const data = { type: "Library", version: APP_VERSION, exportDate: new Date().toISOString(), fixtureTypes: fixtureTypes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `library_${new Date().getTime()}.json`;
    link.click(); URL.revokeObjectURL(url);
    setShowSettings(false);
  };

  const handleResetLibrary = () => {
    setFixtureTypes(INITIAL_FIXTURE_TYPES); setShowResetLibraryConfirm(false); setShowSettings(false); alert("Biblioteca de fixtures reposta para os valores de fábrica!");
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>, type: 'PATCH' | 'LIBRARY') => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        if (type === 'PATCH') {
          const fixturesToImport = json.fixtures || (Array.isArray(json) ? json : null);
          if (fixturesToImport && Array.isArray(fixturesToImport)) {
             setFixtures(fixturesToImport);
             if (json.config?.maxUniverses) setMaxUniverses(json.config.maxUniverses);
             if (json.showName) setShowName(json.showName);
             setSelectedFixtureId(null); setSelectedIds(new Set()); setShowSettings(false);
          } else throw new Error("Formato de patch inválido.");
        } else if (type === 'LIBRARY') {
          const typesToImport = json.fixtureTypes || (Array.isArray(json) ? json : null);
          if (typesToImport && Array.isArray(typesToImport)) {
            setFixtureTypes(prev => {
              const merged = [...prev];
              typesToImport.forEach((nt: FixtureType) => {
                if (!nt.name || !nt.manufacturer || !nt.channels) return;
                const index = merged.findIndex(pt => pt.id === nt.id || (pt.manufacturer === nt.manufacturer && pt.name === nt.name && pt.mode === nt.mode));
                if (index !== -1) merged[index] = { ...merged[index], ...nt };
                else merged.push(nt.id ? nt : { ...nt, id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` });
              });
              return merged;
            });
            setShowSettings(false); alert("Biblioteca importada com sucesso!");
          } else throw new Error("Formato de biblioteca inválido.");
        }
      } catch (err: any) { alert("Erro na importação: " + err.message); }
    };
    reader.readAsText(file); event.target.value = '';
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(22); doc.setTextColor(40); doc.text(showName, 14, 22);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Data: ${new Date().toLocaleString('pt-PT')}`, 14, 30);
    
    let fixturesToProcess = [...fixtures];
    if (!pdfIncludeFixed) fixturesToProcess = fixturesToProcess.filter(f => !f.isFixed);
    
    const totalParams = fixturesToProcess.reduce((acc, f) => acc + (fixtureTypes.find(t => t.id === f.typeId)?.channels || 0), 0);
    doc.text(`Aparelhos no Relatório: ${fixturesToProcess.length} | Parâmetros: ${totalParams}`, 14, 35);
    doc.text(`Patch Emulator ${APP_VERSION}`, pageWidth - 14, 30, { align: 'right' });

    // Multi-level sorting logic
    const sortedForPdf = fixturesToProcess.sort((a, b) => {
      const locA = a.location || '';
      const locB = b.location || '';
      const patchA = a.universe * 1000 + a.address;
      const patchB = b.universe * 1000 + b.address;

      switch (pdfSortMode) {
        case 'fid_loc':
          return a.fid - b.fid || locA.localeCompare(locB);
        case 'loc_fid':
          return locA.localeCompare(locB) || a.fid - b.fid;
        case 'patch_loc':
          return patchA - patchB || locA.localeCompare(locB);
        case 'loc_patch':
          return locA.localeCompare(locB) || patchA - patchB;
        case 'fid_patch':
          return a.fid - b.fid || patchA - patchB;
        case 'patch_fid':
          return patchA - patchB || a.fid - b.fid;
        default:
          return patchA - patchB;
      }
    });

    const tableData = sortedForPdf.map(f => {
      const type = fixtureTypes.find(t => t.id === f.typeId);
      return [ f.fid, f.name, type?.manufacturer || '-', type?.name || '-', type?.mode || '-', `${f.universe}.${f.address}`, f.location || '-', f.isFixed ? 'Sim' : 'Não', type?.channels || 0 ];
    });

    autoTable(doc, {
      startY: 45, head: [['FID', 'Nome', 'Fabricante', 'Tipo', 'Modo', 'Patch', 'Localização', 'Fixo', 'Chs']], body: tableData,
      headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }, margin: { top: 45, bottom: 25 }, styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 5: { cellWidth: 15 }, 7: { cellWidth: 12 }, 8: { cellWidth: 10 } },
      didDrawPage: (data) => {
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Patch Emulator ${APP_VERSION} - Relatório de Montagem | Desenvolvido por Carlos La Rua`, 14, pageHeight - 10);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
      }
    });

    doc.save(`${showName.replace(/\s+/g, '_').toLowerCase()}_patch.pdf`);
    setShowExportPDFDialog(false);
  };

  const handleLoadRoomPatch = (roomData: any) => {
    setFixtures(roomData.fixtures); setMaxUniverses(roomData.config.maxUniverses); setShowName(roomData.name);
    setSelectedFixtureId(null); setSelectedIds(new Set()); setRoomToLoad(null); setShowHouseRigs(false);
    alert(`Patch do ${roomData.name} carregado com sucesso!`);
  };

  const handleEditInitiate = (fixture: FixtureInstance) => {
    const type = fixtureTypes.find(t => t.id === fixture.typeId); if (!type) return;
    setEditingFixtureId(fixture.id); setNewFid(fixture.fid.toString()); setNewName(fixture.name);
    setNewUniverse(fixture.universe.toString()); setNewAddress(fixture.address.toString());
    setNewLocation(fixture.location || PATCH_LOCATIONS[0]); setNewIsFixed(fixture.isFixed || false);
    setSelectedFixtureKey(`${type.manufacturer} - ${type.name}`); setSelectedModeId(type.id);
    setUseNextFree(false); setErrorMessage(null); setShowEditManual(true);
  };

  const initiateBulkEdit = (sortedFixtures: FixtureInstance[]) => {
    const selectedFixtures = sortedFixtures.filter(f => selectedIds.has(f.id));
    if (selectedFixtures.length === 0) return;
    setCurrentVisualOrder(selectedFixtures);
    const first = selectedFixtures[0]; setBulkName(first.name); setBulkUseNamePattern(false);
    setBulkTypeId(first.typeId); setBulkUniverse(first.universe.toString());
    setBulkAddress(first.address.toString()); setBulkLocation(first.location || PATCH_LOCATIONS[0]);
    setBulkIsFixed(first.isFixed || false); setBulkFid(first.fid.toString());
    setBulkUpdateName(false); setBulkUpdateType(false); setBulkUpdatePatch(false);
    setBulkUpdateLocation(false); setBulkUpdateIsFixed(false); setBulkUpdateFid(false);
    setErrorMessage(null); setShowBulkEdit(true);
  };

  const handleBulkEditSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setErrorMessage(null);
    const targetIds = Array.from(selectedIds); const targets = currentVisualOrder;
    let currentUni = parseInt(bulkUniverse); let currentAddr = parseInt(bulkAddress); let currentFid = parseInt(bulkFid);
    const updatedFixtures = [...fixtures];
    if (bulkUpdateFid) {
        const otherFids = new Set(fixtures.filter(f => !selectedIds.has(f.id)).map(f => f.fid));
        for (let i = 0; i < targets.length; i++) if (otherFids.has(currentFid + i)) { setErrorMessage(`Falha na edição: O FID ${currentFid + i} já está em uso por outro aparelho fora da seleção.`); return; }
    }
    for (let i = 0; i < targets.length; i++) {
      const f = targets[i]; const idx = updatedFixtures.findIndex(uf => uf.id === f.id);
      const newValues: Partial<FixtureInstance> = {};
      if (bulkUpdateName) newValues.name = bulkUseNamePattern ? `${bulkName} ${i + 1}` : bulkName;
      if (bulkUpdateFid) { newValues.fid = currentFid; currentFid++; }
      if (bulkUpdateType) {
        newValues.typeId = bulkTypeId;
        const type = fixtureTypes.find(t => t.id === bulkTypeId);
        if (type) newValues.color = getManufacturerColor(type.manufacturer);
      }
      if (bulkUpdateLocation) newValues.location = bulkLocation;
      if (bulkUpdateIsFixed) newValues.isFixed = bulkIsFixed;
      if (bulkUpdatePatch) {
        const typeId = newValues.typeId || f.typeId; const type = fixtureTypes.find(t => t.id === typeId)!;
        const collision = checkCollision(currentUni, currentAddr, type.channels, targetIds);
        if (collision) { setErrorMessage(`Falha no Re-patch Massa: ${collision}`); return; }
        newValues.universe = currentUni; newValues.address = currentAddr; currentAddr += type.channels;
        if (currentAddr > 512) { currentUni++; currentAddr = 1; if (currentUni > maxUniverses) { setErrorMessage("Erro: Limite de universos excedido no re-patch massa."); return; } }
      }
      updatedFixtures[idx] = { ...updatedFixtures[idx], ...newValues };
    }
    setFixtures(updatedFixtures); setShowBulkEdit(false); setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    setFixtures(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set()); setShowBulkDeleteConfirm(false);
    if (selectedFixtureId && selectedIds.has(selectedFixtureId)) setSelectedFixtureId(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setErrorMessage(null);
    if (!newName.trim()) { setErrorMessage("Por favor, preencha o nome do fixture."); return; }
    const qty = parseInt(quantity) || 1; const startFid = parseInt(newFid); const startUni = parseInt(newUniverse); const startAddr = parseInt(newAddress);
    if (startFid < 1) { setErrorMessage("O FID deve ser um número positivo."); return; }
    const selectedType = fixtureTypes.find(t => t.id === selectedModeId); if (!selectedType) return;
    const manufacturerColor = getManufacturerColor(selectedType.manufacturer);
    const nextSeq = getNextSequenceNumber(selectedModeId, newName);
    const newAddedFixtures: FixtureInstance[] = [];
    let currentFid = startFid; let currentAddr = startAddr; let currentUni = startUni;
    for (let i = 0; i < qty; i++) {
      if (fixtures.some(f => f.fid === currentFid)) { setErrorMessage(`FID ${currentFid} já está em uso.`); return; }
      const collision = checkCollision(currentUni, currentAddr, selectedType.channels);
      if (collision) { setErrorMessage(collision); return; }
      const finalName = `${newName} ${nextSeq + i}`;
      newAddedFixtures.push({ id: `fix-${Date.now()}-${i}`, fid: currentFid, name: finalName, typeId: selectedModeId, universe: currentUni, address: currentAddr, color: manufacturerColor, location: newLocation, isFixed: newIsFixed });
      currentFid++; currentAddr += selectedType.channels;
      if (currentAddr > 512) { currentUni++; currentAddr = 1; if (currentUni > maxUniverses) { setErrorMessage("Limite de universos atingido."); return; } }
    }
    setFixtures(prev => [...prev, ...newAddedFixtures]); setShowAddManual(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingFixtureId) return; setErrorMessage(null);
    const fidVal = parseInt(newFid); const uniVal = parseInt(newUniverse); const addrVal = parseInt(newAddress);
    const selectedType = fixtureTypes.find(t => t.id === selectedModeId)!;
    if (fixtures.some(f => f.fid === fidVal && f.id !== editingFixtureId)) { setErrorMessage(`FID ${fidVal} já está em uso.`); return; }
    const collision = checkCollision(uniVal, addrVal, selectedType.channels, editingFixtureId);
    if (collision) { setErrorMessage(collision); return; }
    setFixtures(prev => prev.map(f => f.id === editingFixtureId ? { ...f, fid: fidVal, name: newName, typeId: selectedModeId, universe: uniVal, address: addrVal, color: getManufacturerColor(selectedType.manufacturer), location: newLocation, isFixed: newIsFixed } : f));
    setShowEditManual(false); setEditingFixtureId(null);
  };

  const selectedFixture = useMemo(() => fixtures.find(f => f.id === selectedFixtureId), [fixtures, selectedFixtureId]);
  const selectedFixtureType = useMemo(() => selectedFixture ? fixtureTypes.find(t => t.id === selectedFixture.typeId) : null, [selectedFixture, fixtureTypes]);

  return (
    <div className={`h-[100dvh] w-screen flex flex-col ${s.bg} ${s.text} overflow-hidden transition-colors duration-300`}>
      <header className={`h-14 border-b ${s.border} ${s.bgElevated} flex items-center justify-between px-2 sm:px-4 shrink-0 shadow-sm z-30`}>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className={`p-2 rounded-md transition-colors hidden md:flex items-center justify-center ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}>{isSidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} className="text-yellow-500" />}</button>
          <div className="flex items-center gap-1 sm:gap-2 bg-yellow-500/10 px-2 sm:px-3 py-1 rounded border border-yellow-500/20 shrink-0">
            <Database size={18} className="text-yellow-500" />
            <span className="font-bold text-yellow-500 tracking-tighter uppercase text-sm hidden sm:inline">Patch Emulator</span>
          </div>
          <div className={`h-6 w-px ${s.border} hidden sm:block`} />
          <div className={`flex ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-200'} rounded-lg p-1 shrink-0`}>
            <button onClick={() => setViewMode('fixtureList')} className={`px-2 sm:px-3 py-1 rounded text-sm flex items-center gap-2 transition-all ${viewMode === 'fixtureList' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
              <List size={14} />
              <span className="hidden sm:inline">Fixtures</span>
            </button>
            <button onClick={() => setViewMode('dmxSheet')} className={`px-2 sm:px-3 py-1 rounded text-sm flex items-center gap-2 transition-all ${viewMode === 'dmxSheet' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">DMX Sheet</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button onClick={() => setShowHouseRigs(true)} className={`px-2 sm:px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${theme === 'dark' ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
            <Building size={18} /> 
            <span className="hidden lg:inline">Gestão de Salas</span>
            <span className="hidden sm:inline lg:hidden">Salas</span>
          </button>
          <button onClick={() => { setErrorMessage(null); setNewFid((fixtures.length > 0 ? Math.max(...fixtures.map(f => f.fid)) + 1 : 1).toString()); setQuantity('1'); setUseNextFree(true); setNewIsFixed(false); setShowAddManual(true); }} className="bg-yellow-500 hover:bg-yellow-400 text-black px-2 sm:px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <Plus size={18} /> 
            <span className="hidden sm:inline">Novo Fixture</span>
          </button>
          <button onClick={() => setShowSettings(true)} className={`p-1.5 sm:p-2 ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}>
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <aside className={`${isSidebarVisible ? 'w-48 sm:w-64 border-r' : 'w-0 border-r-0'} ${s.border} ${s.bgSidebar} flex flex-col shrink-0 transition-all duration-300 hidden md:flex overflow-hidden`}>
          <div className={`p-4 border-b ${s.border} overflow-y-auto max-h-[40vh] shrink-0`}><h3 className={`text-xs font-bold ${s.textMuted} uppercase tracking-widest mb-3 flex justify-between items-center`}>Universos <span className={`text-[9px] ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-300 text-slate-600'} px-1.5 py-0.5 rounded`}>1 - {maxUniverses}</span></h3><div className="grid grid-cols-4 gap-1">{Array.from({ length: maxUniverses }, (_, i) => i + 1).map(num => (<button key={num} onClick={() => setActiveUniverse(num)} className={`h-10 rounded border flex flex-col items-center justify-center transition-all ${activeUniverse === num ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500 font-bold' : `${theme === 'dark' ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-500'} hover:border-slate-400`}`}><span className="text-[10px] leading-tight">U</span><span className="text-sm leading-tight">{num}</span></button>))}</div></div>
          <div className="flex-1 overflow-auto p-4 min-h-0">
             <div className="space-y-3">
                {selectedFixture ? (
                   <div className={`bg-blue-600/10 rounded-lg p-3 border border-blue-500/30 space-y-3 animate-in fade-in zoom-in duration-300`}><div className="flex items-center gap-2 text-blue-400"><Search size={14} /><span className="text-xs font-bold uppercase tracking-tight text-ellipsis overflow-hidden whitespace-nowrap">Focado no Fixture</span></div><div className="space-y-1"><div className={`text-lg font-black leading-tight break-words flex items-center gap-2 ${selectedFixture.isFixed ? 'text-red-500' : (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>{selectedFixture.isFixed && <Anchor size={16} />}{selectedFixture.name}</div><div className="text-[10px] text-blue-500 font-mono">ID: {selectedFixture.id.slice(-6)}</div></div><div className="space-y-2"><div className="grid grid-cols-2 gap-2"><div className={`${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} p-2 rounded border`}><div className={`text-[9px] ${s.textMuted} uppercase font-bold mb-1`}>FID</div><div className="text-sm font-mono font-bold text-yellow-500">{selectedFixture.fid}</div></div><div className={`${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} p-2 rounded border`}><div className={`text-[9px] ${s.textMuted} uppercase font-bold mb-1`}>Patch</div><div className="text-sm font-mono font-bold text-blue-400">{selectedFixture.universe}.{selectedFixture.address}</div></div></div><div className={`${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} p-2 rounded border space-y-2`}><div className="flex items-start gap-2"><Tag size={12} className="text-slate-400 mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><div className={`text-[9px] ${s.textMuted} uppercase font-bold`}>Tipo</div><div className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'} line-clamp-2 break-words`}>{selectedFixtureType?.name || '---'}</div></div></div><div className={`flex items-start gap-2 pt-2 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}><MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><div className={`text-[9px] ${s.textMuted} uppercase font-bold`}>Localização</div><div className={`text-[11px] font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} line-clamp-1`}>{selectedFixture.location || '---'}</div></div></div></div></div><button onClick={() => setSelectedFixtureId(null)} className={`w-full py-1.5 text-[10px] font-bold uppercase ${s.textMuted} hover:text-yellow-500 transition-colors`}>Limpar Seleção</button></div>
                ) : (
                  <div className={`${s.card} rounded-lg p-3 border space-y-4`}><div className="flex items-center gap-2"><Monitor size={14} className="text-yellow-500" /><span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} uppercase tracking-tight`}>Estatísticas</span></div><div className="space-y-3"><div className="space-y-1"><div className="flex justify-between text-[10px] font-bold uppercase"><span className={s.textMuted}>Parâmetros</span><span className={`${s.text} font-mono`}>{stats.totalParameters}</span></div><div className={`w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} h-1.5 rounded-full overflow-hidden`}><div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, (stats.totalParameters / MAX_PARAMETERS) * 100)}%` }} /></div></div><div className="space-y-1"><div className="flex justify-between text-[10px] font-bold uppercase"><span className={s.textMuted}>Universo {activeUniverse}</span><span className={`${s.text} font-mono`}>{stats.currentUniPercent}%</span></div><div className={`w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} h-1.5 rounded-full overflow-hidden`}><div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${stats.currentUniPercent}%` }} /></div></div></div><div className={`grid grid-cols-2 gap-2 pt-2 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}><div className={`${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'} p-2 rounded border ${s.border}`}><div className={`text-[9px] ${s.textMuted} uppercase font-bold mb-1 flex items-center gap-1 whitespace-nowrap`}><Box size={10} /> Fixtures</div><div className="text-lg font-mono font-bold">{stats.totalFixtures}</div></div><div className={`${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'} p-2 rounded border ${s.border}`}><div className={`text-[9px] ${s.textMuted} uppercase font-bold mb-1 flex items-center gap-1 whitespace-nowrap`}><Layers size={10} /> Universos</div><div className="text-lg font-mono font-bold">{stats.universesCount}</div></div></div></div>
                )}
             </div>
          </div>
        </aside>

        <div className={`flex-1 flex flex-col relative p-2 sm:p-4 ${s.bgContent} transition-colors min-h-0 min-w-0`}><div className="md:hidden flex flex-col gap-2 mb-3 shrink-0"><div className="flex items-center justify-between px-1"><span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Selecionar Universo</span><div className="flex gap-1"><button onClick={() => mobileUniScrollRef.current?.scrollBy({ left: -100, behavior: 'smooth' })} className="p-1 rounded bg-slate-800 text-slate-400"><ChevronLeft size={14} /></button><button onClick={() => mobileUniScrollRef.current?.scrollBy({ left: 100, behavior: 'smooth' })} className="p-1 rounded bg-slate-800 text-slate-400"><ChevronRight size={14} /></button></div></div><div ref={mobileUniScrollRef} className={`flex items-center gap-2 overflow-x-auto pb-2 px-1 scroll-smooth ${theme === 'dark' ? 'mobile-scrollbar-dark' : 'mobile-scrollbar-light'}`}><div className="flex gap-2">{Array.from({ length: maxUniverses }, (_, i) => i + 1).map(num => (<button key={num} onClick={() => setActiveUniverse(num)} className={`w-12 h-12 shrink-0 rounded-lg flex flex-col items-center justify-center transition-all border shadow-sm ${activeUniverse === num ? 'bg-yellow-500 text-black border-yellow-400 font-black scale-105 shadow-yellow-500/20' : `${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}`}><span className={`text-[8px] leading-none ${activeUniverse === num ? 'text-black/60' : 'text-slate-500'}`}>UNI</span><span className="text-base leading-none">{num}</span></button>))}</div></div></div><div className="flex-1 min-h-0 min-w-0">{viewMode === 'fixtureList' ? (<FixtureList fixtures={fixtures} types={fixtureTypes} onDelete={setFixtureToDelete} onEdit={handleEditInitiate} selectedIds={selectedIds} onToggleSelection={toggleSelection} onToggleAll={toggleAll} onBulkEdit={initiateBulkEdit} onBulkDelete={() => setShowBulkDeleteConfirm(true)} theme={theme} showName={showName} />) : (<DmxSheet universe={currentUniverse} fixtures={fixtures} types={fixtureTypes} selectedFixtureId={selectedFixtureId} onCellClick={handleCellClick} />)}</div></div>
      </main>

      {/* Manual Add/Edit Modal */}
      {(showAddManual || showEditManual) && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-2 sm:p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-slate-700 shadow-2xl' : 'bg-white border-slate-300 shadow-2xl shadow-yellow-500/10'} border-2 rounded-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95dvh]`}>
            <div className={`${theme === 'dark' ? 'bg-slate-800/80' : 'bg-white'} p-4 sm:p-5 border-b ${s.border} flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><Plus size={24} className="text-yellow-500" /></div>
                <h2 className={`text-xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase`}>{showEditManual ? 'Editar Fixture' : 'Manual Patch'}</h2>
              </div>
              <button onClick={() => { setShowAddManual(false); setShowEditManual(false); }} className={`p-2 rounded-full hover:bg-red-500/10 ${s.textMuted} hover:text-red-500 transition-all`}><X size={24} /></button>
            </div>
            
            <form onSubmit={showEditManual ? handleEditSubmit : handleManualSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                {errorMessage && (
                  <div className={`p-4 rounded-xl flex items-start gap-4 text-sm animate-in shake-1 duration-200 ${errorMessage.startsWith('Aviso') ? 'bg-yellow-500/10 border border-yellow-500/50 text-yellow-600' : 'bg-red-500/10 border border-red-500/50 text-red-400'}`}>
                    {errorMessage.startsWith('Aviso') ? <AlertTriangle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                    <p className="font-medium leading-relaxed">{errorMessage}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {!showEditManual && (
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black ${s.textMuted} uppercase ml-1 tracking-wider`}>Quantidade</label>
                      <input type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(e.target.value)} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-4 font-black text-lg transition-all`} required />
                    </div>
                  )}
                  <div className={`${showEditManual ? 'col-span-2' : ''} space-y-1.5`}>
                    <label className={`text-[10px] font-black ${s.textMuted} uppercase ml-1 tracking-wider`}>{showEditManual ? 'FID (Fixture ID)' : 'FID Inicial'}</label>
                    <input type="number" min="1" value={newFid} onChange={e => setNewFid(e.target.value)} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-4 font-mono font-black text-yellow-500 text-xl transition-all`} required />
                  </div>
                </div>

                <div className={`p-4 rounded-xl border-2 ${theme === 'dark' ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-400/40 bg-blue-50/30'} space-y-3`}>
                  <label className={`text-[10px] font-black ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} uppercase ml-1 tracking-wider`}>Nome do Fixture (Sequência)</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Maverick Spot..." className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-4 font-bold text-base transition-all`} required />
                </div>

                <div className={`p-4 rounded-xl border-2 ${theme === 'dark' ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-100'} flex items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${newIsFixed ? 'bg-slate-700 text-white shadow-inner shadow-black/50' : 'bg-slate-500 text-white/50'}`}>
                      <Anchor size={22} />
                    </div>
                    <div>
                      <div className={`text-xs font-black uppercase ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Montagem Fixa</div>
                      <div className={`text-[10px] font-bold ${s.textMuted}`}>Aparelho da estrutura permanente da sala</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setNewIsFixed(!newIsFixed)} className={`w-14 h-7 rounded-full transition-all duration-300 relative flex items-center ${newIsFixed ? 'bg-slate-700' : 'bg-slate-400'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-lg ${newIsFixed ? 'translate-x-[32px]' : 'translate-x-[4px]'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className={`text-[10px] font-black ${s.textMuted} uppercase tracking-wider`}>Fabricante / Modelo</label>
                      <button type="button" onClick={() => { setShowAddManual(false); setShowFixtureEditor(true); }} className="text-[10px] font-black text-yellow-500 hover:text-yellow-400 flex items-center gap-1 uppercase tracking-tighter transition-colors"><Plus size={10} /> Novo</button>
                    </div>
                    <select value={selectedFixtureKey} onChange={e => setSelectedFixtureKey(e.target.value)} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-3 font-black text-sm appearance-none cursor-pointer`}>
                      {Object.keys(fixtureGroups).map(key => (<option key={key} value={key}>{key}</option>))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black ${s.textMuted} uppercase ml-1 tracking-wider`}>Localização</label>
                    <select value={newLocation} onChange={e => setNewLocation(e.target.value)} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-3 font-black text-sm appearance-none cursor-pointer`}>
                      {PATCH_LOCATIONS.map(loc => (<option key={loc} value={loc}>{loc}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black ${s.textMuted} uppercase ml-1 tracking-wider`}>Modo de Operação</label>
                    <select value={selectedModeId} onChange={e => setSelectedModeId(e.target.value)} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-3 font-black text-sm appearance-none transition-all cursor-pointer`}>
                      {fixtureGroups[selectedFixtureKey]?.map(mode => (<option key={mode.id} value={mode.id}>{mode.mode} ({mode.channels} canais)</option>))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black ${s.textMuted} uppercase ml-1 tracking-wider`}>Universo</label>
                    <input type="number" value={newUniverse} onChange={e => setNewUniverse(e.target.value)} min="1" max={maxUniverses} className={`w-full h-12 ${s.input} ${s.inputFocus} border-2 rounded-xl px-4 font-black text-xl text-blue-500 transition-all`} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className={`text-[10px] font-black ${s.textMuted} uppercase tracking-wider`}>Endereço DMX</label>
                    <button type="button" onClick={() => setUseNextFree(!useNextFree)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all duration-300 ${useNextFree ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      {useNextFree ? <Check size={14} strokeWidth={4} /> : <Activity size={14} />} NEXT FREE
                    </button>
                  </div>
                  <input type="number" value={newAddress} onChange={e => { setNewAddress(e.target.value); setUseNextFree(false); }} min="1" max="512" className={`w-full h-14 ${s.input} ${s.inputFocus} border-2 rounded-xl px-4 font-mono font-black text-2xl transition-all ${useNextFree ? 'opacity-40 select-none' : 'opacity-100'}`} required />
                </div>
              </div>

              <div className={`p-4 sm:p-6 ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'} border-t-2 ${s.border} flex gap-4 shrink-0`}>
                <button type="button" onClick={() => { setShowAddManual(false); setShowEditManual(false); }} className={`flex-1 h-14 rounded-xl font-black uppercase tracking-widest text-sm transition-all duration-200 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>Cancelar</button>
                <button type="submit" className="flex-[1.5] h-14 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-yellow-700">
                  <Plus size={20} strokeWidth={3} /> <span className="hidden xs:inline">{showEditManual ? 'Guardar' : 'Confirmar'}</span><span className="xs:hidden">Confirmar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* House Rigs Management Modal */}
      {showHouseRigs && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[220] p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-5 border-b ${s.border} flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Building2 size={24} /></div>
                <h2 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Gestão de Salas Fixas</h2>
              </div>
              <button onClick={() => setShowHouseRigs(false)} className={`p-2 rounded-full hover:bg-red-500/10 ${s.textMuted} hover:text-red-500 transition-all`}><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className={`text-sm ${s.textMuted} leading-relaxed`}>Selecione uma sala para carregar a sua iluminação fixa. Esta ação irá <strong>substituir</strong> o patch atual.</p>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setRoomToLoad(FIXED_GA_PATCH)} className="flex items-center justify-between p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <Building2 className="text-blue-500 group-hover:scale-110 transition-transform" size={28} />
                    <div className="text-left">
                      <div className="font-black text-slate-200 uppercase text-sm tracking-tight">Grande Auditório</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Instalação Fixa 50 Fixtures - 24 Universos DMX</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
                <button onClick={() => setRoomToLoad(FIXED_PA_PATCH)} className="flex items-center justify-between p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <Home className="text-emerald-500 group-hover:scale-110 transition-transform" size={28} />
                    <div className="text-left">
                      <div className="font-black text-slate-200 uppercase text-sm tracking-tight">Pequeno Auditório</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Instalação Fixa 44 Fixtures - 2 Universos DMX</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
                <button onClick={() => setRoomToLoad(FIXED_BB_PATCH)} className="flex items-center justify-between p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <Tent className="text-purple-500 group-hover:scale-110 transition-transform" size={28} />
                    <div className="text-left">
                      <div className="font-black text-slate-200 uppercase text-sm tracking-tight">BlackBox</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Instalação Fixa ?? Fixtures - 2 Universos DMX</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
              </div>
            </div>
            <div className={`p-4 bg-slate-900/40 border-t ${s.border} text-center`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">Rig da Casa - Atualizado para Versão {APP_VERSION}</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Loading Room */}
      {roomToLoad && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-yellow-500/30' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={40} className="text-yellow-500" /></div>
              <div className="space-y-2"><h2 className="text-2xl font-black uppercase tracking-tight">Confirmar Carga?</h2><p className="text-sm text-slate-500 leading-relaxed">Deseja carregar o rig fixo da sala <strong>{roomToLoad.name}</strong>? Todo o seu patch atual será perdido.</p></div>
              <div className="flex flex-col gap-3">
                <button onClick={() => handleLoadRoomPatch(roomToLoad)} className="w-full h-14 rounded-xl bg-yellow-500 text-black font-black uppercase shadow-xl active:scale-95 transition-all">Substituir e Carregar</button>
                <button onClick={() => setRoomToLoad(null)} className="w-full h-14 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase hover:bg-slate-700 transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className={`${theme === 'dark' ? 'bg-[#0f0f0f] border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95dvh]`}>
            <div className={`${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-slate-100'} p-5 border-b ${s.border} flex justify-between items-center shrink-0`}>
              <h2 className={`font-black flex items-center gap-3 uppercase tracking-tight text-yellow-500`}><Settings size={22} /> Opções do Sistema</h2>
              <button onClick={() => setShowSettings(false)} className={`p-2 rounded-full hover:bg-red-500/10 text-slate-500 hover:text-red-500`}><X size={24} /></button>
            </div>
            <div className="p-5 space-y-8 overflow-y-auto flex-1">
              <section className="space-y-3">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${s.textMuted}`}>Detalhes do Espetáculo</h3>
                <div className={`p-4 rounded-xl border ${s.border} ${theme === 'dark' ? 'bg-[#141414]' : 'bg-slate-50'} space-y-2`}>
                  <label className="text-center text-[10px] font-black uppercase text-slate-500 ml-1">Nome do Local / Show</label>
                  <input type="text" value={showName} onChange={e => setShowName(e.target.value)} className={`w-full h-12 ${s.input} rounded-xl px-4 text-base font-bold border ${s.border} ${s.inputFocus}`} placeholder="Ex: Concerto de Jazz..." />
                </div>
              </section>
              <section className="space-y-3">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${s.textMuted}`}>INTERFACE</h3>
                <div className={`flex items-center justify-between p-4 rounded-xl border ${s.border} ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-4">
                    {theme === 'dark' ? <Moon size={22} className="text-blue-400" /> : <Sun size={22} className="text-yellow-500" />}
                    <span className="text-sm font-black uppercase tracking-tight">Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</span>
                  </div>
                  <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-14 h-7 rounded-full transition-all relative flex items-center ${theme === 'dark' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'bg-slate-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-md ${theme === 'dark' ? 'translate-x-[32px]' : 'translate-x-[4px]'}`} />
                  </button>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${s.textMuted}`}>CONFIGURAÇÃO DE HARDWARE</h3>
                <div className={`p-5 rounded-xl border ${s.border} ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-slate-50'} space-y-6`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Sliders size={20} className="text-yellow-500" />
                      <span className="text-sm font-black uppercase tracking-tight">Limite de Universos</span>
                    </div>
                    <span className="text-sm font-black font-mono text-yellow-500">{maxUniverses} Uni</span>
                  </div>
                  <div className="space-y-2">
                    <input type="range" min="1" max="128" value={maxUniverses} onChange={(e) => { const val = parseInt(e.target.value); setMaxUniverses(val); if (activeUniverse > val) setActiveUniverse(val); }} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                    <div className="flex justify-between text-[10px] font-black text-slate-500">
                      <span>1 UNI</span><span className="text-yellow-500/80">TOTAL: {(maxUniverses * 512).toLocaleString()} PARAMS</span><span>128 UNI</span>
                    </div>
                  </div>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${s.textMuted}`}>GESTÃO DE DADOS DO PATCH</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setShowSettings(false); setShowExportPDFDialog(true); }} className="col-span-2 w-full flex items-center gap-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all text-left">
                    <FileText size={22} className="text-yellow-500" />
                    <span className="text-sm font-black uppercase text-yellow-500 tracking-tight">Exportar Patch (PDF)</span>
                  </button>
                  <button onClick={handleExportPatch} className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all">
                    <Download size={20} className="text-blue-400" />
                    <span className="text-xs font-black uppercase text-blue-400">Exportar Json</span>
                  </button>
                  <button onClick={() => patchFileInputRef.current?.click()} className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all">
                    <Upload size={20} className="text-emerald-400" />
                    <span className="text-xs font-black uppercase text-emerald-400">Importar Json</span>
                  </button>
                  <button onClick={() => { setShowSettings(false); setShowResetConfirm(true); }} className="col-span-2 w-full flex items-center gap-4 p-4 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all text-left">
                    <Trash2 size={22} className="text-red-500" />
                    <span className="text-sm font-black uppercase text-red-500 tracking-tight">Limpar Todo o Patch</span>
                  </button>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${s.textMuted}`}>BIBLIOTECA DE FIXTURES</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setShowSettings(false); setShowFixtureEditor(true); }} className="col-span-2 w-full flex items-center gap-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all text-left">
                    <Wrench size={22} className="text-yellow-500" />
                    <span className="text-sm font-black uppercase text-yellow-500 tracking-tight">Fixture Builder (Editor)</span>
                  </button>
                  <button onClick={handleExportLibrary} className="flex items-center gap-3 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-all">
                    <BookOpen size={20} className="text-purple-400" />
                    <span className="text-xs font-black uppercase text-purple-400">Exportar Biblio</span>
                  </button>
                  <button onClick={() => libraryFileInputRef.current?.click()} className="flex items-center gap-3 p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-all">
                    <Upload size={20} className="text-orange-400" />
                    <span className="text-xs font-black uppercase text-orange-400">Importar Biblio</span>
                  </button>
                  <button onClick={() => setShowResetLibraryConfirm(true)} className="col-span-2 w-full flex items-center gap-4 p-4 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all text-left">
                    <RotateCcw size={22} className="text-red-500" />
                    <span className="text-sm font-black uppercase text-red-500 tracking-tight">Repor Biblioteca Padrão</span>
                  </button>
                </div>
              </section>
            </div>
            <div className={`p-4 bg-slate-900/40 border-t ${s.border} text-center`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Patch Emulator {APP_VERSION} - Portugal</span>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" ref={patchFileInputRef} onChange={(e) => handleFileImport(e, 'PATCH')} accept=".json" className="hidden" />
      <input type="file" ref={libraryFileInputRef} onChange={(e) => handleFileImport(e, 'LIBRARY')} accept=".json" className="hidden" />

      {/* Reset Confirmation Modals */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><Trash2 size={40} className="text-red-500" /></div>
            <div className="space-y-2"><h2 className="text-2xl font-black uppercase tracking-tight">Limpar Todo o Patch?</h2><p className="text-sm text-slate-500 leading-relaxed">Esta ação é irreversível e removerá todos os aparelhos de todos os universos.</p></div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setFixtures([]); setShowResetConfirm(false); setShowSettings(false); setSelectedFixtureId(null); setSelectedIds(new Set()); }} className="w-full h-14 rounded-xl bg-red-500 text-white font-black uppercase">Sim, Apagar Tudo</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full h-14 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showResetLibraryConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4"><RotateCcw size={40} className="text-red-500" /></div>
            <div className="space-y-2"><h2 className="text-2xl font-black uppercase tracking-tight">Repor Biblioteca?</h2><p className="text-sm text-slate-500 leading-relaxed">Deseja remover todas as fixtures personalizadas e voltar à biblioteca original?</p></div>
            <div className="flex flex-col gap-3">
              <button onClick={handleResetLibrary} className="w-full h-14 rounded-xl bg-red-500 text-white font-black uppercase">Confirmar Reposição</button>
              <button onClick={() => setShowResetLibraryConfirm(false)} className="w-full h-14 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
          <div className="bg-[#1a1a1a] border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={40} className="text-red-500" /></div>
            <div className="space-y-2"><h2 className="text-2xl font-black uppercase tracking-tight text-white">Eliminar Seleção?</h2><p className="text-sm text-slate-500 leading-relaxed">Deseja apagar permanentemente os <strong>{selectedIds.size} aparelhos</strong> selecionados?</p></div>
            <div className="flex flex-col gap-3">
              <button onClick={handleBulkDelete} className="w-full h-14 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black uppercase shadow-lg shadow-red-500/20 transition-all">Sim, Eliminar Tudo</button>
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="w-full h-14 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase hover:bg-slate-700 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-2 sm:p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-slate-700 shadow-2xl' : 'bg-white border-slate-200'} border rounded-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95dvh]`}>
            <div className={`p-4 sm:p-5 border-b ${s.border} flex justify-between items-center shrink-0`}><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10"><ListChecks size={24} className="text-yellow-500" /></div><h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">Edição Massa ({selectedIds.size} Fixtures)</h2></div><button onClick={() => setShowBulkEdit(false)} className={`p-2 rounded-full hover:bg-red-500/10 ${s.textMuted} hover:text-red-500 transition-all`}><X size={24} /></button></div>
            <form onSubmit={handleBulkEditSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden"><div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">{errorMessage && (<div className={`p-4 rounded-xl flex items-start gap-4 text-sm animate-in shake-1 bg-red-500/10 border border-red-500/50 text-red-400`}><AlertCircle size={20} className="shrink-0" /><p>{errorMessage}</p></div>)}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-4 rounded-xl border transition-all ${bulkUpdateName ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800 bg-slate-900/20 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <button type="button" onClick={() => setBulkUpdateName(!bulkUpdateName)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${bulkUpdateName ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-slate-600'}`}>{bulkUpdateName && <Check size={14} strokeWidth={4} />}</button>
                  <span className="text-xs font-bold uppercase tracking-wider">Alterar Nome</span>
                </div>
                <div className="space-y-4">
                  <input type="text" value={bulkName} onChange={e => setBulkName(e.target.value)} disabled={!bulkUpdateName} className={`w-full h-10 ${s.input} rounded-lg px-3 text-sm`} placeholder="Nome base..." />
                  <div className="flex items-center gap-2 px-1"><input type="checkbox" id="pattern" checked={bulkUseNamePattern} onChange={e => setBulkUseNamePattern(e.target.checked)} disabled={!bulkUpdateName} className="accent-yellow-500" /><label htmlFor="pattern" className="text-[10px] font-bold uppercase text-slate-500 cursor-pointer">Adicionar Numeração (1, 2, 3...)</label></div>
                </div>
              </div>
              <div className={`p-4 rounded-xl border transition-all ${bulkUpdateFid ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800 bg-slate-900/20 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <button type="button" onClick={() => setBulkUpdateFid(!bulkUpdateFid)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${bulkUpdateFid ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-slate-600'}`}>{bulkUpdateFid && <Check size={14} strokeWidth={4} />}</button>
                  <span className="text-xs font-bold uppercase tracking-wider">Novo FID Inicial</span>
                </div>
                <div className="space-y-4"><input type="number" value={bulkFid} onChange={e => setBulkFid(e.target.value)} disabled={!bulkUpdateFid} className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm font-mono text-yellow-500 font-bold" min="1" /></div>
              </div>
              <div className={`p-4 rounded-xl border transition-all ${bulkUpdateLocation ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800 bg-slate-900/20 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <button type="button" onClick={() => setBulkUpdateLocation(!bulkUpdateLocation)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${bulkUpdateLocation ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-slate-600'}`}>{bulkUpdateLocation && <Check size={14} strokeWidth={4} />}</button>
                  <span className="text-xs font-bold uppercase tracking-wider">Nova Localização</span>
                </div>
                <div className="space-y-4"><select value={bulkLocation} onChange={e => setBulkLocation(e.target.value)} disabled={!bulkUpdateLocation} className={`w-full h-10 ${s.input} rounded-lg px-3 text-sm`}>{PATCH_LOCATIONS.map(loc => (<option key={loc} value={loc}>{loc}</option>))}</select></div>
              </div>
              <div className={`p-4 rounded-xl border transition-all ${bulkUpdatePatch ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800 bg-slate-900/20 opacity-50'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <button type="button" onClick={() => setBulkUpdatePatch(!bulkUpdatePatch)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${bulkUpdatePatch ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-slate-600'}`}>{bulkUpdatePatch && <Check size={14} strokeWidth={4} />}</button>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Re-Patch Massa</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500">Uni</label><input type="number" value={bulkUniverse} onChange={e => setBulkUniverse(e.target.value)} disabled={!bulkUpdatePatch} className={`w-full h-10 ${s.input} rounded-lg px-3 text-sm font-bold text-blue-400`} min="1" max={maxUniverses} /></div>
                  <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500">Addr</label><input type="number" value={bulkAddress} onChange={e => setBulkAddress(e.target.value)} disabled={!bulkUpdatePatch} className={`w-full h-10 ${s.input} rounded-lg px-3 text-sm font-bold`} min="1" max="512" /></div>
                </div>
              </div>
            </div>
            </div><div className={`p-4 sm:p-6 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50'} border-t ${s.border} flex gap-4 shrink-0`}><button type="button" onClick={() => setShowBulkEdit(false)} className="flex-1 h-12 rounded-xl font-bold uppercase bg-slate-800 text-slate-400">Descartar</button><button type="submit" className="flex-[1.5] h-12 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-black uppercase shadow-xl">Aplicar Alterações</button></div></form>
          </div>
        </div>
      )}

      {/* Export PDF Modal - Enhanced with Sort Options */}
      {showExportPDFDialog && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95dvh]`}>
            <div className={`p-6 border-b ${s.border} flex justify-between items-center shrink-0`}>
              <h2 className="font-black flex items-center gap-3 uppercase tracking-tight text-yellow-500"><FileDown size={24} /> Exportar Patch</h2>
              <button onClick={() => setShowExportPDFDialog(false)} className={`${s.textMuted} hover:text-white transition-colors`}><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nome do Espetáculo</label>
                <input type="text" value={showName} onChange={e => setShowName(e.target.value)} className={`w-full h-12 ${s.input} rounded-xl px-4 font-bold text-lg border ${s.border}`} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Ordem de Exportação</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPdfSortMode('fid_loc')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'fid_loc' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Hash size={14} />
                      <span className="text-[10px] font-bold uppercase">FID &rarr; Localização</span>
                    </div>
                    {pdfSortMode === 'fid_loc' && <Check size={14} />}
                  </button>

                  <button 
                    onClick={() => setPdfSortMode('loc_fid')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'loc_fid' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={14} />
                      <span className="text-[10px] font-bold uppercase">Localização &rarr; FID</span>
                    </div>
                    {pdfSortMode === 'loc_fid' && <Check size={14} />}
                  </button>

                  <button 
                    onClick={() => setPdfSortMode('patch_loc')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'patch_loc' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Activity size={14} />
                      <span className="text-[10px] font-bold uppercase">Patch &rarr; Localização</span>
                    </div>
                    {pdfSortMode === 'patch_loc' && <Check size={14} />}
                  </button>

                  <button 
                    onClick={() => setPdfSortMode('loc_patch')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'loc_patch' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={14} />
                      <span className="text-[10px] font-bold uppercase">Localização &rarr; Patch</span>
                    </div>
                    {pdfSortMode === 'loc_patch' && <Check size={14} />}
                  </button>

                  {/* Novas Opções */}
                  <button 
                    onClick={() => setPdfSortMode('fid_patch')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'fid_patch' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Hash size={14} />
                      <span className="text-[10px] font-bold uppercase">FID &rarr; Patch</span>
                    </div>
                    {pdfSortMode === 'fid_patch' && <Check size={14} />}
                  </button>

                  <button 
                    onClick={() => setPdfSortMode('patch_fid')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${pdfSortMode === 'patch_fid' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Activity size={14} />
                      <span className="text-[10px] font-bold uppercase">Patch &rarr; FID</span>
                    </div>
                    {pdfSortMode === 'patch_fid' && <Check size={14} />}
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${s.border} ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${pdfIncludeFixed ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'}`}><Anchor size={20} /></div>
                  <div>
                    <div className="text-xs font-black uppercase text-slate-300 tracking-tight">Incluir Aparelhos Fixos?</div>
                    <div className="text-[10px] text-slate-500 font-medium">Relatório inclui iluminação de sala</div>
                  </div>
                </div>
                <button type="button" onClick={() => setPdfIncludeFixed(!pdfIncludeFixed)} className={`w-14 h-7 rounded-full transition-all relative flex items-center ${pdfIncludeFixed ? 'bg-yellow-500' : 'bg-slate-700'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${pdfIncludeFixed ? 'translate-x-[32px]' : 'translate-x-[4px]'}`} /></button>
              </div>
            </div>

            <div className={`p-6 ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'} border-t ${s.border} flex gap-4 shrink-0`}>
              <button onClick={() => setShowExportPDFDialog(false)} className="flex-1 h-12 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase">Cancelar</button>
              <button onClick={handleExportPDF} className="flex-[1.5] h-12 rounded-xl bg-yellow-500 text-black font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10"><Download size={18} /> Gerar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Fixture Builder Modal */}
      {showFixtureEditor && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-slate-700 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'} border rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90dvh]`}>
            <div className={`p-5 border-b ${s.border} flex justify-between items-center`}><h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-yellow-500"><Wrench /> Fixture Builder</h2><button onClick={() => setShowFixtureEditor(false)} className="text-slate-500 hover:text-white"><X size={24} /></button></div>
            <form onSubmit={handleCreateFixtureType} className="p-6 space-y-6 overflow-y-auto flex-1"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-bold uppercase text-slate-500">Fabricante</label><input type="text" value={editorManufacturer} onChange={e => setEditorManufacturer(e.target.value)} className={`w-full h-11 ${s.input} rounded-xl px-4 font-bold`} required /></div><div className="space-y-1.5"><label className="text-xs font-bold uppercase text-slate-500">Modelo</label><input type="text" value={editorName} onChange={e => setEditorName(e.target.value)} className={`w-full h-11 ${s.input} rounded-xl px-4 font-bold`} required /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-bold uppercase text-slate-500">Modo</label><input type="text" value={editorMode} onChange={e => setEditorMode(e.target.value)} className={`w-full h-11 ${s.input} rounded-xl px-4 font-bold`} required /></div><div className="space-y-1.5"><label className="text-xs font-bold uppercase text-slate-500">Canais DMX</label><input type="number" min="1" max="512" value={editorChannels} onChange={e => setEditorChannels(e.target.value)} className={`w-full h-11 ${s.input} rounded-xl px-4 font-bold`} required /></div></div></form>
            <div className={`p-6 border-t ${s.border} flex gap-4`}><button type="button" onClick={() => setShowFixtureEditor(false)} className="flex-1 h-12 rounded-xl font-bold bg-slate-800 text-slate-400">Cancelar</button><button onClick={handleCreateFixtureType} className="flex-1 h-12 rounded-xl bg-yellow-500 text-black font-black uppercase">Adicionar</button></div>
          </div>
        </div>
      )}

      {/* Individual Delete Modal */}
      {fixtureToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
          <div className={`${theme === 'dark' ? 'bg-[#1a1a1a] border-red-500/30' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200`}><div className="p-8 text-center space-y-6"><div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={40} className="text-red-500" /></div><div className="space-y-2"><h2 className="text-2xl font-black uppercase tracking-tight text-white">Eliminar Fixture?</h2><p className="text-sm text-slate-500 leading-relaxed">Remover <strong>{fixtureToDelete.name} (FID {fixtureToDelete.fid})</strong>?</p></div><div className="flex gap-4"><button onClick={() => setFixtureToDelete(null)} className="flex-1 h-14 rounded-xl bg-slate-800 text-slate-400 font-bold uppercase hover:bg-slate-700 transition-colors">Não</button><button onClick={() => { setFixtures(prev => prev.filter(f => f.id !== fixtureToDelete.id)); setFixtureToDelete(null); if (selectedFixtureId === fixtureToDelete.id) setSelectedFixtureId(null); }} className="flex-1 h-14 rounded-xl bg-red-500 text-white font-black uppercase hover:bg-red-400 transition-all">Sim, Eliminar</button></div></div></div>
        </div>
      )}

      <footer className={`h-8 ${s.bgElevated} border-t ${s.border} flex items-center px-4 justify-between text-[10px] uppercase font-bold ${s.textMuted} shrink-0 z-30`}>
        <div className="flex gap-4"><span>Patch Emulator {APP_VERSION}</span></div>
        <div className="flex gap-4 items-center"><span>Desenvolvido por Carlos La Rua</span></div>
      </footer>
    </div>
  );
};

export default App;
