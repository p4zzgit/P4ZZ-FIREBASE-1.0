import { GoogleGenAI } from "@google/genai";

export const getSalesInsights = async (sales, products) => {
  try {
    if (!sales.length) return "Realize algumas vendas para que eu possa analisar seu desempenho.";

    const summary = `
      Vendas Totais: ${sales.length}
      Receita Total: R$ ${sales.reduce((acc, s) => acc + s.total, 0).toFixed(2)}
      Produtos em Estoque: ${products.length}
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analise estes dados de vendas em PT-BR e dê 2 dicas rápidas e acionáveis para o dono do negócio: ${summary}`,
    });

    return response.text || "Sem insights no momento.";
  } catch (error) {
    console.warn("Gemini Sales Insights Error:", error);
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return "Cota diária de IA atingida. A análise retornará em breve.";
    }
    return "IA temporariamente indisponível para análise estratégica.";
  }
};

export const generateProductDescription = async (productName) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crie uma descrição de marketing de apenas 1 frase curta para o produto: ${productName}`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    return "";
  }
};