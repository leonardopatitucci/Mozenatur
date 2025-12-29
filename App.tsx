
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Bus, School as SchoolIcon, Users, MapPin, Plus, Trash2, Navigation, Clock, Loader2,
  UserCheck, Truck, Armchair, Timer, ExternalLink, MessageCircle, UserMinus, Navigation2
} from 'lucide-react';
import { School, Student, RouteAnalysis, RouteStep, Van } from './types';
import { optimizeRoute } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vans' | 'escolas' | 'alunos' | 'rota'>('vans');
  const [schools, setSchools] = useState<School[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [route, setRoute] = useState<RouteAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedVanId, setSelectedVanId] = useState<string>('');
  const [geoStatus, setGeoStatus] = useState<'searching' | 'active' | 'denied'>('searching');
  
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);

  const [newVan, setNewVan] = useState<Partial<Van>>({ vanNumber: '', model: '', plate: '', driverName: '', capacity: 15, startAddress: '' });
  const [newSchool, setNewSchool] = useState<Partial<School>>({ name: '', address: '', entryTime: '07:30', exitTime: '12:00', stopDuration: 5 });
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ name: '', address: '', schoolId: '', vanId: '', stopDuration: 2, parentPhone: '' });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      console.error("Geolocalização não é suportada por este navegador.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newCoords);
        if(geoStatus !== 'active') {
          setGeoStatus('active');
        }
        if (busMarkerRef.current) {
          busMarkerRef.current.setLatLng(newCoords);
        }
      },
      (err) => {
        console.error("Erro de geolocalização:", err.message);
        if (err.code === 1) { // PERMISSION_DENIED
          setGeoStatus('denied');
        }
      },
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'rota') {
      setTimeout(() => {
        if (!mapRef.current) {
          const initialView = userPos || [-23.5505, -46.6333];
          mapRef.current = L.map('map').setView(initialView, 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(mapRef.current);
          markersRef.current = L.layerGroup().addTo(mapRef.current);
        } else {
          mapRef.current.invalidateSize();
        }
        if (route) {
          renderRouteOnMap();
        }
      }, 100); // Delay to ensure map container is visible and sized correctly
    }
  }, [activeTab, route]);

  const renderRouteOnMap = async () => {
    if (!mapRef.current || !markersRef.current || !route) return;
    
    markersRef.current.clearLayers();
    if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

    const waypoints = route.steps.map(s => `${s.lng},${s.lat}`).join(';');
    
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
        routeLayerRef.current = L.polyline(coordinates, { color: '#4f46e5', weight: 6, opacity: 0.8 }).addTo(mapRef.current);
        mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
      } else {
        throw new Error("OSRM did not return a route.");
      }
    } catch (e) {
      console.warn("OSRM fallback:", e);
      const simplePoints = route.steps.map(s => [s.lat, s.lng] as L.LatLngExpression);
      routeLayerRef.current = L.polyline(simplePoints, { color: '#ef4444', weight: 4, opacity: 0.7, dashArray: '5, 10' }).addTo(mapRef.current);
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });
    }

    route.steps.forEach((step, idx) => {
      const colorClass = step.type === 'PICKUP' ? 'bg-emerald-500' : step.type === 'DROPOFF' ? 'bg-indigo-600' : 'bg-slate-900';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="custom-marker-content ${colorClass}">${idx + 1}</div>`,
        iconSize: [32, 32]
      });
      L.marker([step.lat, step.lng], { icon }).bindPopup(`<b>${step.time}</b>: ${step.description}`).addTo(markersRef.current!);
    });

    if (userPos) {
      const busIcon = L.divIcon({
        className: 'bus-marker',
        html: `<div class="bg-amber-400 p-2 rounded-full shadow-2xl border-2 border-slate-900 animate-pulse"><svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
        iconSize: [40, 40], iconAnchor: [20, 20]
      });
      if (!busMarkerRef.current) busMarkerRef.current = L.marker(userPos, { icon: busIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      else busMarkerRef.current.setLatLng(userPos);
    }
  };

  const togglePresence = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isAbsent: !s.isAbsent } : s));
  };
  
  const sendWhatsApp = (phone?: string, name?: string) => {
    if (!phone) return alert('Número de telefone não cadastrado para este aluno.');
    const msg = encodeURIComponent(`Olá! Sou da MozenaTur. Estou chegando para buscar o(a) ${name} em aproximadamente 5 minutos! 🚐`);
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const generateRoute = async () => {
    const van = vans.find(v => v.id === selectedVanId);
    if (!van) return alert("Por favor, selecione uma Van para a rota.");
    const presentStudents = students.filter(s => s.vanId === selectedVanId && !s.isAbsent);
    if (presentStudents.length === 0) return alert("Não há alunos presentes para esta van hoje.");
    
    setLoading(true);
    setRoute(null);
    try {
      const res = await optimizeRoute(schools, presentStudents, van, userPos ? `${userPos[0]},${userPos[1]}` : null);
      setRoute(res);
      setActiveTab('rota');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  
  const addEntity = (type: 'van' | 'school' | 'student') => {
    if (type === 'van') {
      if(newVan.vanNumber && newVan.model) {
        setVans([...vans, { ...newVan, id: Date.now().toString() } as Van]);
        setNewVan({ vanNumber: '', model: '', plate: '', driverName: '', capacity: 15, startAddress: '' });
      }
    } else if (type === 'school') {
       if (newSchool.name && newSchool.address) {
         setSchools([...schools, { ...newSchool, id: Date.now().toString() } as School]);
         setNewSchool({ name: '', address: '', entryTime: '07:30', exitTime: '12:00', stopDuration: 5 });
       }
    } else if (type === 'student') {
       if (newStudent.name && newStudent.vanId && newStudent.schoolId) {
         setStudents([...students, { ...newStudent, id: Date.now().toString(), isAbsent: false } as Student]);
         setNewStudent({ name: '', address: '', schoolId: '', vanId: '', stopDuration: 2, parentPhone: '' });
       }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-24 md:pb-0">
      <header className="bg-indigo-600 p-6 shadow-xl sticky top-0 z-[1000]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-amber-400 p-3 rounded-2xl shadow-inner">
              <Bus className="w-8 h-8 text-indigo-900" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">MozenaTur</h1>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Logística Escolar Inteligente</p>
            </div>
          </div>
          {geoStatus === 'searching' && (
            <div className="text-xs font-black flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              LOCALIZANDO...
            </div>
          )}
          {geoStatus === 'active' && (
             <div className="text-xs font-black flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/20 text-emerald-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              GPS ATIVO
            </div>
          )}
           {geoStatus === 'denied' && (
             <div className="text-xs font-black flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-400/20 text-rose-300">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              GPS NEGADO
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
        <div className="hidden md:flex gap-4 mb-10 bg-white p-2 rounded-3xl shadow-sm border border-slate-200">
          <TabButton active={activeTab === 'vans'} onClick={() => setActiveTab('vans')} icon={<Truck />} label="Frota" />
          <TabButton active={activeTab === 'escolas'} onClick={() => setActiveTab('escolas')} icon={<SchoolIcon />} label="Escolas" />
          <TabButton active={activeTab === 'alunos'} onClick={() => setActiveTab('alunos')} icon={<Users />} label="Alunos & Chamada" />
          <TabButton active={activeTab === 'rota'} onClick={() => setActiveTab('rota')} icon={<Navigation2 />} label="Roteiro Ativo" />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-6 md:p-8 min-h-[600px]">
          {/* VANS TAB */}
          {activeTab === 'vans' && (
            <section className="animate-tab-entry space-y-8">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-800">Cadastro de Vans</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                <Input label="Nº da Van" value={newVan.vanNumber} onChange={v => setNewVan({...newVan, vanNumber: v})} placeholder="Ex: 01" />
                <Input label="Modelo" value={newVan.model} onChange={v => setNewVan({...newVan, model: v})} placeholder="Ex: Sprinter" />
                <Input label="Placa" value={newVan.plate} onChange={v => setNewVan({...newVan, plate: v})} placeholder="ABC-1234" />
                <Input label="Assentos" type="number" value={newVan.capacity} onChange={v => setNewVan({...newVan, capacity: parseInt(v) || 0})} />
                <div className="md:col-span-2"><Input label="Motorista" value={newVan.driverName} onChange={v => setNewVan({...newVan, driverName: v})} /></div>
                <div className="md:col-span-2"><Input label="Endereço de Partida" value={newVan.startAddress} onChange={v => setNewVan({...newVan, startAddress: v})} /></div>
                <button onClick={() => addEntity('van')} className="md:col-span-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Plus size={18} /> Adicionar à Frota
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vans.map(v => (
                  <div key={v.id} className="group flex items-center justify-between p-6 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-300 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-5">
                      <div className="bg-slate-900 text-amber-400 w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-b-4 border-amber-500">
                        <span className="text-[10px] font-black opacity-60">VAN</span>
                        <span className="text-xl font-black">{v.vanNumber}</span>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg uppercase">{v.model}</h3>
                        <p className="text-xs text-slate-400 font-mono tracking-widest">{v.plate}</p>
                         <div className="flex gap-2 mt-2">
                           <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-md text-slate-600 flex items-center gap-1 uppercase"><Armchair size={12}/> {v.capacity} Lugares</span>
                           <span className="text-[10px] font-bold bg-indigo-50 px-2 py-1 rounded-md text-indigo-600 flex items-center gap-1 uppercase"><UserCheck size={12}/> {v.driverName}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setVans(vans.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={20} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ESCOLAS TAB */}
          {activeTab === 'escolas' && (
            <section className="animate-tab-entry space-y-8">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-800">Unidades Escolares</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                <div className="md:col-span-2"><Input label="Nome da Escola" value={newSchool.name} onChange={v => setNewSchool({...newSchool, name: v})} /></div>
                <div className="md:col-span-2"><Input label="Endereço Completo" value={newSchool.address} onChange={v => setNewSchool({...newSchool, address: v})} /></div>
                <Input label="Horário de Entrada" type="time" value={newSchool.entryTime} onChange={v => setNewSchool({...newSchool, entryTime: v})} />
                <Input label="Horário de Saída" type="time" value={newSchool.exitTime} onChange={v => setNewSchool({...newSchool, exitTime: v})} />
                <div className="md:col-span-2"><Input label="Tempo de Parada (min)" type="number" value={newSchool.stopDuration} onChange={v => setNewSchool({...newSchool, stopDuration: parseInt(v) || 5})} /></div>
                <button onClick={() => addEntity('school')} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Plus size={18} /> Cadastrar Escola
                </button>
              </div>
              <div className="space-y-3">
                {schools.map(s => (
                  <div key={s.id} className="group flex items-center justify-between p-6 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-300 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-5">
                      <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center">
                        <SchoolIcon size={32} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">{s.name}</h3>
                        <p className="text-sm text-slate-500">{s.address}</p>
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Clock size={14}/> Entrada: {s.entryTime}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSchools(schools.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={20} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ALUNOS TAB */}
           {activeTab === 'alunos' && (
            <section className="animate-tab-entry space-y-8">
              <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-800">Alunos & Chamada do Dia</h2>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nome Completo do Aluno" value={newStudent.name} onChange={v => setNewStudent({...newStudent, name: v})} />
                  <Input label="Endereço de Coleta" value={newStudent.address} onChange={v => setNewStudent({...newStudent, address: v})} />
                  <Input label="WhatsApp do Responsável" value={newStudent.parentPhone} onChange={v => setNewStudent({...newStudent, parentPhone: v})} placeholder="(00) 00000-0000" />
                  <Input label="Tempo de Embarque (min)" type="number" value={newStudent.stopDuration} onChange={v => setNewStudent({...newStudent, stopDuration: parseInt(v) || 2})} />
                  <Select label="Van" value={newStudent.vanId} onChange={v => setNewStudent({...newStudent, vanId: v})}>
                    <option value="">Selecione...</option>
                    {vans.map(v => <option key={v.id} value={v.id}>VAN {v.vanNumber} - {v.driverName}</option>)}
                  </Select>
                  <Select label="Escola" value={newStudent.schoolId} onChange={v => setNewStudent({...newStudent, schoolId: v})}>
                    <option value="">Selecione...</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <button onClick={() => addEntity('student')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                  <UserCheck size={18} /> Cadastrar Aluno
                </button>
              </div>
              <div className="space-y-3">
                {students.map(st => (
                  <div key={st.id} className={`p-4 border rounded-[2rem] flex justify-between items-center transition-all ${st.isAbsent ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                    <div className="flex items-center gap-4">
                       <button onClick={() => togglePresence(st.id)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${st.isAbsent ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'}`}>
                          {st.isAbsent ? <UserMinus size={24} /> : <UserCheck size={24} />}
                       </button>
                       <div>
                         <h3 className={`font-extrabold text-lg ${st.isAbsent ? 'line-through text-slate-400' : 'text-slate-800'}`}>{st.name}</h3>
                         <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-[9px] bg-slate-100 px-2 py-1 rounded-md font-bold uppercase text-slate-600">Van {vans.find(v => v.id === st.vanId)?.vanNumber || '?'}</span>
                            <span className="text-[9px] bg-indigo-50 px-2 py-1 rounded-md font-bold uppercase text-indigo-600">{schools.find(s => s.id === st.schoolId)?.name || '?'}</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       {!st.isAbsent && (
                         <button onClick={() => sendWhatsApp(st.parentPhone, st.name)} title="Notificar via WhatsApp" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors">
                           <MessageCircle size={20} />
                         </button>
                       )}
                       <button onClick={() => setStudents(students.filter(x => x.id !== st.id))} className="p-3 text-slate-300 hover:text-rose-500 transition-colors">
                         <Trash2 size={20} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ROTA TAB */}
           {activeTab === 'rota' && (
            <section className="animate-tab-entry space-y-8">
               <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-inner">
                <div className="flex flex-col gap-2 w-full md:w-80">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Selecionar Veículo</label>
                   <select value={selectedVanId} onChange={e => setSelectedVanId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10">
                      <option value="">Escolha a Van para a rota...</option>
                      {vans.map(v => <option key={v.id} value={v.id}>VAN {v.vanNumber} - {v.driverName}</option>)}
                   </select>
                </div>
                <button onClick={generateRoute} disabled={loading || !selectedVanId} className="w-full md:w-auto bg-amber-400 hover:bg-amber-500 text-indigo-900 font-black px-12 py-5 rounded-2xl uppercase text-xs tracking-widest shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : <><Navigation size={20} /> Otimizar Rota de Hoje</>}
                </button>
              </div>
              <div id="map" className="rounded-[2rem] shadow-2xl border-8 border-white h-[450px] overflow-hidden"></div>
              {route && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl md:col-span-2 relative overflow-hidden">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2">Análise da IA</h3>
                       <p className="text-sm leading-relaxed text-slate-300 font-medium">{route.summary}</p>
                     </div>
                     <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center">
                       <div className="flex justify-around">
                         <div>
                           <span className="text-sm font-bold uppercase opacity-60">Tempo</span>
                           <p className="text-3xl font-black">{route.totalTime}</p>
                         </div>
                         <div>
                           <span className="text-sm font-bold uppercase opacity-60">Distância</span>
                           <p className="text-3xl font-black">{route.totalDistance}</p>
                         </div>
                       </div>
                     </div>
                  </div>
                  <div className="relative pl-12 space-y-6 before:absolute before:left-[15px] before:top-6 before:bottom-6 before:w-1.5 before:bg-slate-100 before:rounded-full">
                    {route.steps.map((step, idx) => (
                      <div key={idx} className="relative group bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
                        <div className={`absolute -left-[48px] top-5 custom-marker-content z-10 transition-transform group-hover:scale-110 ${
                          // FIX: Corrected typo from 'DROFF' to 'DROPOFF' to match the type definition.
                          step.type === 'PICKUP' ? 'bg-emerald-500' : step.type === 'DROPOFF' ? 'bg-indigo-600' : 'bg-slate-900'
                        }`}>{idx+1}</div>
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <span className="text-2xl font-black text-slate-800">{step.time}</span>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[9px] font-black text-slate-400 uppercase">{step.travelTimeFromPrevious || 'Início da Rota'}</span>
                              </div>
                           </div>
                           {step.actionUrl && (
                             <a href={step.actionUrl} target="_blank" title="Abrir no Google Maps" className="bg-slate-100 p-3 rounded-xl hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                               <ExternalLink size={20} />
                             </a>
                           )}
                        </div>
                        <h4 className="font-extrabold text-slate-700 uppercase tracking-tight mb-1">{step.description}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-2 font-medium"><MapPin size={14} className="text-indigo-400" /> {step.location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200 flex md:hidden h-24 z-[2000] px-4 shadow-[0_-15px_40px_rgba(0,0,0,0.1)]">
        <MobileTabButton active={activeTab === 'vans'} onClick={() => setActiveTab('vans')} icon={<Truck />} label="Vans" />
        <MobileTabButton active={activeTab === 'escolas'} onClick={() => setActiveTab('escolas')} icon={<SchoolIcon />} label="Escolas" />
        <MobileTabButton active={activeTab === 'alunos'} onClick={() => setActiveTab('alunos')} icon={<Users />} label="Alunos" />
        <MobileTabButton active={activeTab === 'rota'} onClick={() => setActiveTab('rota')} icon={<Navigation2 />} label="Mapa" />
      </nav>
    </div>
  );
};

const Input: React.FC<{ label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1">{label}</label>
    <input 
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} 
      className="w-full bg-white border border-slate-300/70 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/20 font-bold text-sm text-slate-700 shadow-sm transition-all" 
    />
  </div>
);

const Select: React.FC<{ label: string, value: any, onChange: (v: string) => void, children: React.ReactNode }> = ({ label, value, onChange, children }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1">{label}</label>
    <select 
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-white border border-slate-300/70 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/20 font-bold text-sm text-slate-700 shadow-sm transition-all appearance-none"
    >{children}</select>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black transition-all duration-300 text-sm ${active ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-500 hover:bg-slate-100'}`}>
    {icon} <span className="uppercase tracking-wider">{label}</span>
  </button>
);

const MobileTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactElement<{ size?: number | string }>; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all h-full ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className={`p-3 rounded-2xl ${active ? 'bg-indigo-100' : ''}`}>{React.cloneElement(icon, { size: 28 })}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
