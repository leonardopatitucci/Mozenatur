
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Bus, 
  School as SchoolIcon, 
  Users, 
  MapPin, 
  Plus, 
  Trash2, 
  Navigation, 
  Clock, 
  Loader2,
  CheckCircle2,
  Bell,
  AlertTriangle,
  Send,
  UserCheck,
  CalendarDays,
  Target,
  Truck,
  Armchair,
  Hash,
  Timer,
  Sun,
  Moon,
  Coffee,
  Calendar,
  ExternalLink,
  ArrowRightLeft,
  LogOut,
  LogIn,
  RotateCcw,
  Save
} from 'lucide-react';
import { School, Student, RouteAnalysis, RouteStep, Van, Shift, RoutePeriod, DayOfWeek } from './types';
import { optimizeRoute } from './services/geminiService';

const ALL_DAYS: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vans' | 'escolas' | 'alunos' | 'rota'>('vans');
  const [schools, setSchools] = useState<School[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [route, setRoute] = useState<RouteAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedVanId, setSelectedVanId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<RoutePeriod>('CEDO');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('SEG');
  
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);

  // Persistence: Load data on Mount
  useEffect(() => {
    const savedVans = localStorage.getItem('mozenatur_vans');
    const savedSchools = localStorage.getItem('mozenatur_schools');
    const savedStudents = localStorage.getItem('mozenatur_students');

    if (savedVans) setVans(JSON.parse(savedVans));
    if (savedSchools) setSchools(JSON.parse(savedSchools));
    if (savedStudents) setStudents(JSON.parse(savedStudents));
  }, []);

  // Persistence: Save data on change
  useEffect(() => {
    localStorage.setItem('mozenatur_vans', JSON.stringify(vans));
  }, [vans]);

  useEffect(() => {
    localStorage.setItem('mozenatur_schools', JSON.stringify(schools));
  }, [schools]);

  useEffect(() => {
    localStorage.setItem('mozenatur_students', JSON.stringify(students));
  }, [students]);

  // Form states
  const [newVan, setNewVan] = useState<Partial<Van>>({ vanNumber: '', model: '', plate: '', driverName: '', capacity: 15, startAddress: '' });
  const [newSchool, setNewSchool] = useState<Partial<School>>({ 
    name: '', 
    address: '', 
    morningEntry: '07:30', 
    morningExit: '12:00', 
    afternoonEntry: '13:00', 
    afternoonExit: '17:30', 
    stopDuration: 5 
  });
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ 
    name: '', 
    address: '', 
    schoolId: '', 
    vanId: '', 
    shift: 'MANHA', 
    daysOfWeek: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], 
    goesToSchool: true, 
    returnsFromSchool: true, 
    stopDuration: 2 
  });

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPos(newCoords);
          if (busMarkerRef.current) busMarkerRef.current.setLatLng(newCoords);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'rota') {
      const timer = setTimeout(() => {
        if (!mapRef.current) {
          const initialView = userPos || [-23.5505, -46.6333];
          mapRef.current = L.map('map').setView(initialView, 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            attribution: '&copy; OpenStreetMap contributors' 
          }).addTo(mapRef.current);
          markersRef.current = L.layerGroup().addTo(mapRef.current);
        } else {
          mapRef.current.invalidateSize();
        }
        if (route) renderRouteOnMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, route]);

  const renderRouteOnMap = async () => {
    if (!mapRef.current || !markersRef.current || !route) return;
    
    markersRef.current.clearLayers();
    if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

    const validSteps = route.steps.filter(s => !isNaN(s.lat) && !isNaN(s.lng));
    if (validSteps.length < 2) return;

    const waypoints = validSteps.map(s => `${s.lng},${s.lat}`).join(';');
    
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
        routeLayerRef.current = L.polyline(coordinates, { color: '#3b82f6', weight: 6, opacity: 0.8 }).addTo(mapRef.current);
        mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      } else {
        throw new Error("OSRM failed");
      }
    } catch (e) {
      const simplePoints = validSteps.map(s => [s.lat, s.lng] as L.LatLngExpression);
      routeLayerRef.current = L.polyline(simplePoints, { color: '#ef4444', weight: 4, dashArray: '8, 12', opacity: 0.6 }).addTo(mapRef.current);
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
    }

    validSteps.forEach((step, idx) => {
      const isStartOrEnd = idx === 0 || idx === validSteps.length - 1;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-transform hover:scale-110 ${
          isStartOrEnd ? 'bg-slate-900 scale-110' : step.type === 'PICKUP' ? 'bg-green-500' : 'bg-blue-600'
        }"><span class="text-[10px] text-white font-bold">${idx + 1}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([step.lat, step.lng], { icon })
        .bindPopup(`<b>Passo ${idx + 1} - ${step.time}</b><br>${step.description}`)
        .addTo(markersRef.current!);
    });

    if (userPos) {
      const busIcon = L.divIcon({
        className: 'bus-marker',
        html: `<div class="bg-yellow-400 p-2 rounded-full shadow-2xl border-2 border-slate-900 animate-pulse"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
        iconSize: [36, 36], iconAnchor: [18, 18]
      });
      if (!busMarkerRef.current) busMarkerRef.current = L.marker(userPos, { icon: busIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      else busMarkerRef.current.setLatLng(userPos);
    }
  };

  const clearAllData = () => {
    if (confirm("Deseja realmente apagar todos os cadastros de vans, escolas e alunos? Esta ação não pode ser desfeita.")) {
      setVans([]);
      setSchools([]);
      setStudents([]);
      setRoute(null);
      localStorage.removeItem('mozenatur_vans');
      localStorage.removeItem('mozenatur_schools');
      localStorage.removeItem('mozenatur_students');
      alert("Todos os dados foram removidos com sucesso.");
    }
  };

  const getVanOccupancy = (vanId: string) => {
    return students.filter(s => s.vanId === vanId).length;
  };

  const toggleDay = (day: DayOfWeek) => {
    const current = newStudent.daysOfWeek || [];
    if (current.includes(day)) {
      setNewStudent({...newStudent, daysOfWeek: current.filter(d => d !== day)});
    } else {
      setNewStudent({...newStudent, daysOfWeek: [...current, day]});
    }
  };

  const addVan = () => {
    if (newVan.vanNumber && newVan.model && newVan.plate && newVan.capacity && newVan.startAddress) {
      setVans([...vans, { ...newVan, id: Date.now().toString() } as Van]);
      setNewVan({ vanNumber: '', model: '', plate: '', driverName: '', capacity: 15, startAddress: '' });
    }
  };

  const addSchool = () => {
    if (newSchool.name && newSchool.address) {
      setSchools([...schools, { ...newSchool, id: Date.now().toString() } as School]);
      setNewSchool({ 
        name: '', 
        address: '', 
        morningEntry: '07:30', 
        morningExit: '12:00', 
        afternoonEntry: '13:00', 
        afternoonExit: '17:30', 
        stopDuration: 5 
      });
    }
  };

  const addStudent = () => {
    if (newStudent.name && newStudent.vanId && newStudent.schoolId && newStudent.daysOfWeek?.length) {
      if (!newStudent.goesToSchool && !newStudent.returnsFromSchool) {
        alert("O aluno deve utilizar o transporte em pelo menos uma das rotas (Ida ou Volta).");
        return;
      }
      const van = vans.find(v => v.id === newStudent.vanId);
      if (van && getVanOccupancy(van.id) >= van.capacity) {
        alert("Atenção: Esta van já atingiu a capacidade máxima de assentos!");
        return;
      }
      setStudents([...students, { ...newStudent, id: Date.now().toString(), isPresent: false } as Student]);
      setNewStudent({ 
        ...newStudent, 
        name: '', 
        address: '', 
        daysOfWeek: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
        goesToSchool: true,
        returnsFromSchool: true
      });
    } else {
      alert("Por favor, preencha todos os campos e selecione ao menos um dia da semana.");
    }
  };

  const generateRoute = async () => {
    const van = vans.find(v => v.id === selectedVanId);
    if (!van) return alert("Selecione uma Van.");
    
    const vanStudents = students.filter(s => s.vanId === selectedVanId);
    const dayFiltered = vanStudents.filter(s => s.daysOfWeek.includes(selectedDay));
    const filteredStudents = dayFiltered.filter(s => {
      if (selectedPeriod === 'CEDO') return s.shift === 'MANHA' && s.goesToSchool;
      if (selectedPeriod === 'ALMOCO') {
        const manhaVoltando = s.shift === 'MANHA' && s.returnsFromSchool;
        const tardeIndo = s.shift === 'TARDE' && s.goesToSchool;
        return manhaVoltando || tardeIndo;
      }
      if (selectedPeriod === 'FINAL_TARDE') return s.shift === 'TARDE' && s.returnsFromSchool;
      return false;
    });

    if (filteredStudents.length === 0) return alert(`Não há alunos ativos para ${selectedDay} neste período.`);
    
    setLoading(true);
    try {
      const userLoc = userPos ? { latitude: userPos[0], longitude: userPos[1] } : null;
      const res = await optimizeRoute(schools, filteredStudents, van, selectedPeriod, selectedDay, userLoc);
      setRoute(res);
      setActiveTab('rota');
    } catch (e: any) { 
      alert(e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 md:pb-0 overflow-x-hidden">
      <header className="bg-sky-300 p-6 shadow-md z-[1000]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bus className="w-8 h-8 text-slate-900" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tighter">MozenaTur</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 bg-sky-400/20 px-3 py-1.5 rounded-full border border-sky-400/30">
              <Save size={12} className="text-sky-700" />
              <span className="text-[10px] font-black uppercase text-sky-800 tracking-tighter">Salvo Localmente</span>
            </div>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-slate-700" />}
            <Target size={14} className={userPos ? "text-green-700 animate-pulse" : "text-slate-400"} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6">
        <div className="hidden md:flex gap-4 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <TabButton active={activeTab === 'vans'} onClick={() => setActiveTab('vans')} icon={<Truck size={20} />} label="Vans" />
          <TabButton active={activeTab === 'escolas'} onClick={() => setActiveTab('escolas')} icon={<SchoolIcon size={20} />} label="Escolas" />
          <TabButton active={activeTab === 'alunos'} onClick={() => setActiveTab('alunos')} icon={<Users size={20} />} label="Alunos" />
          <TabButton active={activeTab === 'rota'} onClick={() => setActiveTab('rota')} icon={<Navigation size={20} />} label="Planejar" />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
          {activeTab === 'vans' && (
            <div className="space-y-6 animate-tab-entry">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase flex items-center gap-2"><Truck className="text-orange-500" /> Frota de Vans</h2>
                <button onClick={clearAllData} className="flex items-center gap-1.5 text-red-500 hover:text-red-600 transition-colors text-[10px] font-black uppercase bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                  <RotateCcw size={12} /> Limpar Tudo
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <Input label="Nº da Van" value={newVan.vanNumber} onChange={v => setNewVan({...newVan, vanNumber: v})} placeholder="Ex: 01" />
                <Input label="Modelo" value={newVan.model} onChange={v => setNewVan({...newVan, model: v})} placeholder="Ex: Sprinter" />
                <Input label="Placa" value={newVan.plate} onChange={v => setNewVan({...newVan, plate: v})} placeholder="ABC-1234" />
                <Input label="Assentos" type="number" value={newVan.capacity} onChange={v => setNewVan({...newVan, capacity: parseInt(v) || 0})} />
                <div className="col-span-2 md:col-span-2">
                  <Input label="Motorista" value={newVan.driverName} onChange={v => setNewVan({...newVan, driverName: v})} placeholder="Nome do Condutor" />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <Input label="Início da Rota (Endereço)" value={newVan.startAddress} onChange={v => setNewVan({...newVan, startAddress: v})} placeholder="Endereço exato para o GPS" />
                </div>
                <button onClick={addVan} className="col-span-2 md:col-span-4 bg-orange-500 hover:bg-orange-600 transition-colors text-white font-black py-3 rounded-xl uppercase text-xs shadow-md">Cadastrar Veículo</button>
              </div>
              <div className="space-y-2">
                {vans.length === 0 && <p className="text-center text-slate-400 py-8 text-sm italic">Nenhum veículo cadastrado ainda.</p>}
                {vans.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-900 text-yellow-400 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 border-slate-800">{v.vanNumber}</div>
                      <div>
                        <h3 className="font-bold">{v.model} <span className="text-slate-400 text-xs ml-2 font-mono">{v.plate}</span></h3>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold uppercase"><MapPin size={10} className="text-orange-400" /> Partida: {v.startAddress}</p>
                      </div>
                    </div>
                    <button onClick={() => setVans(vans.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'escolas' && (
            <div className="space-y-6 animate-tab-entry">
              <h2 className="text-xl font-black uppercase flex items-center gap-2"><SchoolIcon className="text-blue-500" /> Unidades Escolares</h2>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Nome da Escola" value={newSchool.name} onChange={v => setNewSchool({...newSchool, name: v})} />
                  <Input label="Endereço Completo" value={newSchool.address} onChange={v => setNewSchool({...newSchool, address: v})} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <h4 className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1"><Sun size={12}/> Período Manhã</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Entrada" type="time" value={newSchool.morningEntry} onChange={v => setNewSchool({...newSchool, morningEntry: v})} />
                      <Input label="Saída" type="time" value={newSchool.morningExit} onChange={v => setNewSchool({...newSchool, morningExit: v})} />
                    </div>
                  </div>

                  <div className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1"><Moon size={12}/> Período Tarde</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Entrada" type="time" value={newSchool.afternoonEntry} onChange={v => setNewSchool({...newSchool, afternoonEntry: v})} />
                      <Input label="Saída" type="time" value={newSchool.afternoonExit} onChange={v => setNewSchool({...newSchool, afternoonExit: v})} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Tempo de Parada (min)" type="number" value={newSchool.stopDuration} onChange={v => setNewSchool({...newSchool, stopDuration: parseInt(v) || 0})} />
                </div>

                <button onClick={addSchool} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-black py-3 rounded-xl uppercase text-xs shadow-sm">Cadastrar Escola</button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {schools.length === 0 && <p className="text-center text-slate-400 py-8 text-sm italic">Nenhuma escola cadastrada ainda.</p>}
                {schools.map(s => (
                  <div key={s.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition-all">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">{s.name}</h3>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <div className="text-[9px] font-bold text-amber-600 uppercase flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <Sun size={10} /> M: {s.morningEntry} - {s.morningExit}
                        </div>
                        <div className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          <Moon size={10} /> T: {s.afternoonEntry} - {s.afternoonExit}
                        </div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                          <Timer size={10} /> {s.stopDuration} min
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><MapPin size={10} /> {s.address}</p>
                    </div>
                    <button onClick={() => setSchools(schools.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-red-500 transition-colors ml-4 p-2"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'alunos' && (
            <div className="space-y-6 animate-tab-entry">
              <h2 className="text-xl font-black uppercase flex items-center gap-2"><Users className="text-green-500" /> Alunos</h2>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Nome do Aluno" value={newStudent.name} onChange={v => setNewStudent({...newStudent, name: v})} />
                  <Input label="Endereço de Coleta (Casa)" value={newStudent.address} onChange={v => setNewStudent({...newStudent, address: v})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Van Designada</label>
                      <select value={newStudent.vanId} onChange={e => setNewStudent({...newStudent, vanId: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="">Selecione...</option>
                        {vans.map(v => <option key={v.id} value={v.id}>Van {v.vanNumber} - {v.model}</option>)}
                      </select>
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Escola de Destino</label>
                      <select value={newStudent.schoolId} onChange={e => setNewStudent({...newStudent, schoolId: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="">Selecione...</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Frequência Semanal</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ALL_DAYS.map(day => (
                        <button 
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                            newStudent.daysOfWeek?.includes(day) 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Utilização do Transporte</label>
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => setNewStudent({...newStudent, goesToSchool: !newStudent.goesToSchool})}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${
                          newStudent.goesToSchool 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <LogIn size={14} /> IDA
                      </button>
                      <button 
                        onClick={() => setNewStudent({...newStudent, returnsFromSchool: !newStudent.returnsFromSchool})}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${
                          newStudent.returnsFromSchool 
                            ? 'bg-orange-600 text-white border-orange-600' 
                            : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <LogOut size={14} /> VOLTA
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Turno Letivo</label>
                      <select value={newStudent.shift} onChange={e => setNewStudent({...newStudent, shift: e.target.value as Shift})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="MANHA">Manhã (Cedo/Almoço)</option>
                        <option value="TARDE">Tarde (Almoço/Fim)</option>
                      </select>
                   </div>
                   <Input label="Estimativa Embarque (min)" type="number" value={newStudent.stopDuration} onChange={v => setNewStudent({...newStudent, stopDuration: parseInt(v) || 0})} />
                </div>
                <button onClick={addStudent} className="w-full bg-green-600 hover:bg-green-700 transition-colors text-white font-black py-3 rounded-xl uppercase text-xs shadow-md">Salvar Cadastro Aluno</button>
              </div>
              
              <div className="space-y-3">
                {students.length === 0 && <p className="text-center text-slate-400 py-8 text-sm italic">Nenhum aluno cadastrado ainda.</p>}
                {students.map(st => (
                  <div key={st.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">{st.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase flex items-center gap-1 ${st.shift === 'MANHA' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                          {st.shift === 'MANHA' ? <Sun size={10} /> : <Moon size={10} />} {st.shift}
                        </span>
                        <div className="flex gap-1">
                          {st.goesToSchool && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100 uppercase">Ida</span>
                          )}
                          {st.returnsFromSchool && (
                            <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold border border-orange-100 uppercase">Volta</span>
                          )}
                        </div>
                        <span className="text-[9px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-bold border border-slate-200 uppercase flex items-center gap-1">
                          <Calendar size={10} /> {st.daysOfWeek.join(' • ')}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setStudents(students.filter(x => x.id !== st.id))} className="text-slate-300 hover:text-red-500 transition-colors ml-4 p-2"><Trash2 size={20} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rota' && (
            <div className="space-y-6 animate-tab-entry">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Veículo</label>
                   <select value={selectedVanId} onChange={e => setSelectedVanId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Escolha...</option>
                      {vans.map(v => <option key={v.id} value={v.id}>Van {v.vanNumber} - {v.model}</option>)}
                   </select>
                </div>
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Dia do Planejamento</label>
                   <select value={selectedDay} onChange={e => setSelectedDay(e.target.value as DayOfWeek)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                      {ALL_DAYS.map(d => <option key={d} value={d}>{d === 'SEG' ? 'Segunda' : d === 'TER' ? 'Terça' : d === 'QUA' ? 'Quarta' : d === 'QUI' ? 'Quinta' : 'Sexta'}-feira</option>)}
                   </select>
                </div>
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Turno da Rota</label>
                   <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value as RoutePeriod)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="CEDO">Manhã (Coleta Cedo)</option>
                      <option value="ALMOCO">Almoço (Entrega M / Coleta T)</option>
                      <option value="FINAL_TARDE">Fim do Dia (Entrega Tarde)</option>
                   </select>
                </div>
              </div>

              <button 
                onClick={generateRoute} 
                disabled={loading || !selectedVanId} 
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black px-8 py-5 rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <> <Navigation size={18} /> Otimizar com Trânsito Médio Anual </>}
              </button>

              <div id="map" className="shadow-2xl border-4 border-white h-[400px] overflow-hidden rounded-3xl relative">
                {!route && !loading && (
                  <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] z-10 flex items-center justify-center p-8 text-center">
                    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs">
                      <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-500">Aguardando geração da rota para exibir o mapa dinâmico.</p>
                    </div>
                  </div>
                )}
              </div>

              {route && (
                <div className="space-y-4 animate-tab-entry">
                  <div className="bg-slate-900 text-white p-6 rounded-3xl border-l-[12px] border-yellow-400 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Clock size={18} className="text-yellow-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Previsão Logística Inteligente</span>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200">{route.summary}</p>
                    </div>
                    <Bus className="absolute -right-10 -bottom-10 w-40 h-40 text-white/5 rotate-12" />
                  </div>

                  <div className="relative pl-10 space-y-6 before:absolute before:left-[11px] before:top-4 before:bottom-4 before:w-1 before:bg-slate-100 before:rounded-full">
                    {route.steps.map((step, idx) => (
                      <div key={idx} className="relative bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`absolute -left-[38px] top-4 w-9 h-9 rounded-full border-4 border-white shadow-lg flex items-center justify-center z-10 ${
                          idx === 0 || idx === route.steps.length - 1 ? 'bg-slate-900' : step.type === 'PICKUP' ? 'bg-green-500' : 'bg-blue-600'
                        }`}>
                          <span className="text-white text-[10px] font-black">{idx + 1}</span>
                        </div>
                        <div className="flex justify-between items-start mb-2">
                           <div>
                             <span className="text-2xl font-black text-slate-900">{step.time}</span>
                             <div className="flex items-center gap-2 mt-1">
                               <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${step.type === 'PICKUP' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {step.type === 'PICKUP' ? 'Coleta' : 'Entrega'}
                               </span>
                               {step.trafficStatus === 'HEAVY' && <AlertTriangle size={12} className="text-red-500" />}
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tráfego: {step.trafficStatus === 'LIGHT' ? 'Livre' : step.trafficStatus === 'MODERATE' ? 'Normal' : 'Intenso'}</p>
                           </div>
                        </div>
                        <p className="font-bold text-slate-800 leading-tight">{step.description}</p>
                        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {step.location}</p>
                        
                        {(step.travelTimeFromPrevious || step.distanceFromPrevious) && idx > 0 && (
                          <div className="mt-4 flex gap-4 border-t border-slate-50 pt-3">
                            {step.distanceFromPrevious && (
                              <div className="flex items-center gap-1.5">
                                <Navigation size={10} className="text-slate-300" />
                                <span className="text-[9px] font-black text-slate-500 uppercase">{step.distanceFromPrevious}</span>
                              </div>
                            )}
                            {step.travelTimeFromPrevious && (
                              <div className="flex items-center gap-1.5">
                                <Clock size={10} className="text-slate-300" />
                                <span className="text-[9px] font-black text-slate-500 uppercase">+{step.travelTimeFromPrevious} de viagem</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex md:hidden h-20 z-[2000] px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <MobileTabButton active={activeTab === 'vans'} onClick={() => setActiveTab('vans')} icon={<Truck size={24} />} label="Vans" />
        <MobileTabButton active={activeTab === 'escolas'} onClick={() => setActiveTab('escolas')} icon={<SchoolIcon size={24} />} label="Escolas" />
        <MobileTabButton active={activeTab === 'alunos'} onClick={() => setActiveTab('alunos')} icon={<Users size={24} />} label="Alunos" />
        <MobileTabButton active={activeTab === 'rota'} onClick={() => setActiveTab('rota')} icon={<Navigation size={24} />} label="Rota" />
      </nav>
    </div>
  );
};

const Input: React.FC<{ label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm transition-all placeholder:text-slate-300" 
    />
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black transition-all ${active ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span className="uppercase text-[11px] tracking-widest">{label}</span>
  </button>
);

const MobileTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all ${active ? 'text-blue-600 bg-blue-50/50 rounded-2xl' : 'text-slate-400'}`}>
    {icon} <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
