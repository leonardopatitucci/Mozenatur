
import { GoogleGenAI } from "@google/genai";
import { School, Student, RouteAnalysis, Van } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeRoute = async (
  schools: School[],
  students: Student[], // A lista já vem filtrada, apenas com alunos presentes
  van: Van,
  userLocation: string | null
): Promise<RouteAnalysis> => {
  const prompt = `
    Como um engenheiro de logística sênior da MozenaTur, crie o plano de rota de coleta matinal mais eficiente para a VAN ${van.vanNumber} (${van.model}), dirigida por ${van.driverName}.
    
    **Parâmetros Críticos:**
    - PONTO DE PARTIDA DA VAN: ${van.startAddress}
    - CAPACIDADE MÁXIMA: ${van.capacity} passageiros.
    - PASSAGEIROS PARA HOJE: ${students.length}.
    
    **Destinos (Escolas):**
    ${schools.map(s => `- **${s.name}**: Horário de entrada crucial: **${s.entryTime}**. Endereço: ${s.address}. Tempo de desembarque estimado: ${s.stopDuration} min.`).join('\n')}
    
    **Lista de Coleta (Alunos):**
    ${students.map(st => {
      const school = schools.find(s => s.id === st.schoolId);
      return `- **${st.name}**: Coletar em "${st.address}". Destino: ${school?.name}.`;
    }).join('\n')}

    **Diretrizes da Missão:**
    1.  **PONTUALIDADE É PRIORIDADE MÁXIMA:** Todos os alunos DEVEM chegar em suas respectivas escolas ANTES do horário de entrada. Calcule os tempos de viagem e de coleta para garantir isso.
    2.  **EFICIÊNCIA DE ROTA:** Agrupe as coletas por proximidade geográfica para minimizar a distância total percorrida e o tempo no trânsito.
    3.  **LÓGICA DE MÚLTIPLAS ESCOLAS:** Se houver alunos para diferentes escolas, planeje a rota para deixar os alunos da escola com horário mais cedo primeiro.

    **Formato de Resposta (OBRIGATÓRIO - APENAS JSON):**
    Responda com um único objeto JSON com a seguinte estrutura:
    {
      "summary": "Uma análise estratégica concisa da rota, explicando a lógica principal (ex: 'Rota otimizada iniciando pelo bairro X para agrupar 3 coletas, garantindo chegada na Escola Y com 15 minutos de antecedência.')",
      "totalTime": "Tempo total estimado da rota (ex: '1h 15min')",
      "totalDistance": "Distância total a ser percorrida (ex: '22.5 km')",
      "steps": [
        {
          "time": "HH:mm",
          "location": "Endereço completo da parada",
          "lat": -00.00000,
          "lng": -00.00000,
          "type": "PICKUP" | "DROPOFF" | "START" | "END",
          "description": "Descrição clara e objetiva (ex: 'Coletar [Nome do Aluno]' ou 'Desembarque na [Nome da Escola]')",
          "trafficStatus": "LIGHT" | "MODERATE" | "HEAVY",
          "travelTimeFromPrevious": "X min",
          "distanceFromPrevious": "X km"
        }
      ]
    }
  `;

  try {
    // FIX: Per Gemini API guidelines, `responseMimeType` is not allowed when using the `googleMaps` tool.
    // The prompt instructs the model to return JSON, which is parsed within the try-catch block.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text || "{}";
    const result: RouteAnalysis = JSON.parse(text);
    
    // Pós-processamento para adicionar links de navegação
    if (result.steps) {
      result.steps = result.steps.map(step => ({
        ...step,
        actionUrl: `https://www.google.com/maps/dir/?api=1&destination=${step.lat},${step.lng}`
      }));
    }
    
    return result;

  } catch (e) {
    console.error("Gemini Service Error:", e);
    throw new Error("A IA não conseguiu gerar uma rota otimizada. Verifique se os endereços estão corretos e completos.");
  }
};
