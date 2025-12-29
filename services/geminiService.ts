
import { GoogleGenAI } from "@google/genai";
import { School, Student, RouteAnalysis, Van, RoutePeriod, DayOfWeek } from "../types";

export const optimizeRoute = async (
  schools: School[],
  students: Student[],
  van: Van,
  period: RoutePeriod,
  day: DayOfWeek,
  userLocation: { latitude: number; longitude: number } | null
): Promise<RouteAnalysis> => {
  // Inicialização da instância logo antes do uso para garantir contexto atualizado
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const periodNames = {
    'CEDO': 'Busca matinal (Alunos da Manhã -> Escola)',
    'ALMOCO': 'Misto de Almoço (Alunos da Manhã -> Casa | Alunos da Tarde -> Escola)',
    'FINAL_TARDE': 'Entrega vespertina (Alunos da Tarde -> Casa)'
  };

  const dayNames = {
    'SEG': 'Segunda-feira',
    'TER': 'Terça-feira',
    'QUA': 'Quarta-feira',
    'QUI': 'Quinta-feira',
    'SEX': 'Sexta-feira'
  };

  const prompt = `
    Como um engenheiro de logística sênior especializado em transporte escolar (MozenaTur), gere uma rota otimizada.
    
    CONTEXTO GEOGRÁFICO E TEMPORAL:
    - DIA DA SEMANA: ${dayNames[day]}
    - PERÍODO: ${periodNames[period]}
    - PONTO DE PARTIDA: ${van.startAddress}
    
    REQUISITO CRÍTICO DE TRÂNSITO:
    Ao calcular os horários ('time') e tempos de viagem ('travelTimeFromPrevious'), você DEVE considerar o TRÂNSITO MÉDIO ANUAL para este dia da semana e horário nesta região. Use sua base de dados histórica e a ferramenta Google Maps para validar tempos realistas, evitando atrasos comuns em horários de pico escolar.

    REGRAS LOGÍSTICAS:
    - Roteiro CEDO: Coleta de alunos MANHÃ (Ida: Sim) em casa -> Entrega nas respectivas Escolas (respeitando Horário Entrada Manhã).
    - Roteiro ALMOÇO: 
        1. Coleta alunos MANHÃ (Volta: Sim) nas Escolas (respeitando Horário Saída Manhã) -> Entrega em casa.
        2. Coleta alunos TARDE (Ida: Sim) em casa -> Entrega nas Escolas (respeitando Horário Entrada Tarde).
        Combine as rotas para minimizar quilometragem.
    - Roteiro FINAL_TARDE: Coleta alunos TARDE (Volta: Sim) nas Escolas (respeitando Horário Saída Tarde) -> Entrega em casa.

    DADOS DAS ESCOLAS (COM HORÁRIOS POR TURNO):
    ${schools.map(s => `- ${s.name}: ${s.address} 
      [MANHÃ: Entrada ${s.morningEntry}, Saída ${s.morningExit}]
      [TARDE: Entrada ${s.afternoonEntry}, Saída ${s.afternoonExit}]
      Tempo Parada: ${s.stopDuration}min`).join('\n')}
    
    DADOS DOS ALUNOS ATIVOS:
    ${students.map(st => {
      const school = schools.find(s => s.id === st.schoolId);
      return `- ${st.name}: ${st.address} (Turno: ${st.shift}, Escola: ${school?.name}, Parada: ${st.stopDuration}min)`;
    }).join('\n')}

    INSTRUÇÕES PARA A FERRAMENTA MAPS:
    Consulte cada endereço fornecido para obter LATITUDE e LONGITUDE precisas. Não invente coordenadas.

    FORMATO DE RESPOSTA (JSON APENAS):
    {
      "summary": "Explicação da estratégia de trânsito médio anual adotada para esta rota.",
      "steps": [
        {
          "time": "HH:mm",
          "location": "endereço exato validado no Maps",
          "lat": -00.000000,
          "lng": -00.000000,
          "type": "PICKUP" | "DROPOFF" | "START" | "END",
          "description": "Ação detalhada",
          "studentIds": ["id"],
          "trafficStatus": "LIGHT" | "MODERATE" | "HEAVY",
          "travelTimeFromPrevious": "X min",
          "distanceFromPrevious": "X.X km"
        }
      ]
    }
  `;

  const config: any = {
    tools: [{ googleMaps: {} }],
  };

  if (userLocation) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        }
      }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: config
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Falha na formatação dos dados da rota.");
    
    const data = JSON.parse(jsonMatch[0]);

    return data;
  } catch (e) {
    console.error("Erro na geração da rota inteligente:", e);
    throw new Error("Não foi possível calcular a rota com base no trânsito médio. Verifique os endereços e tente novamente.");
  }
};
