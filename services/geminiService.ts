
import { GoogleGenAI, Type } from "@google/genai";
import { FixtureInstance, FixtureType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getPatchSuggestion = async (
  prompt: string, 
  currentFixtures: FixtureInstance[],
  availableTypes: FixtureType[]
) => {
  const context = `
    És um programador especialista em consolas GrandMA3.
    Responde sempre em Português de Portugal (ex: utiliza "ecrã" em vez de "tela", "ficheiro" em vez de "arquivo", "comando" em vez de "controle").
    
    Livraria de Fixtures disponível: ${JSON.stringify(availableTypes.map(t => ({ name: t.name, channels: t.channels })))}
    Patch Atual: ${JSON.stringify(currentFixtures.map(f => ({ fid: f.fid, name: f.name, patch: `${f.universe}.${f.address}` })))}
    
    Pedido do Utilizador: "${prompt}"
    
    Gera um array JSON de novos fixtures a adicionar. 
    Cada objeto deve conter: fid (número), name (string), typeName (deve coincidir com um dos nomes da livraria), universe (número), address (número).
    Garante que não existem colisões de endereços DMX.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: context,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fid: { type: Type.INTEGER },
              name: { type: Type.STRING },
              typeName: { type: Type.STRING },
              universe: { type: Type.INTEGER },
              address: { type: Type.INTEGER }
            },
            required: ["fid", "name", "typeName", "universe", "address"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Erro na sugestão Gemini:", error);
    return [];
  }
};
