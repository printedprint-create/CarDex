import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageBase64: z.string().min(32),
  mimeType: z.string().min(3),
});

export type CarGuess = {
  make: string | null;
  model: string | null;
  year_from: number | null;
  price_eur: number | null;
  units_produced: number | null;
  confidence: "alta" | "media" | "baja";
  note: string;
};

const carSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    make: { type: ["string", "null"], description: "Marca del coche" },
    model: { type: ["string", "null"], description: "Modelo y versión si se aprecia" },
    year_from: { type: ["number", "null"], description: "Año aproximado de la generación" },
    price_eur: {
      type: ["number", "null"],
      description: "Precio aproximado de mercado en euros",
    },
    units_produced: {
      type: ["number", "null"],
      description: "Unidades fabricadas aproximadas si es un modelo limitado",
    },
    confidence: { type: "string", enum: ["alta", "media", "baja"] },
    note: { type: "string", description: "Explicación breve en español, una o dos frases" },
  },
  required: ["make", "model", "year_from", "price_eur", "units_produced", "confidence", "note"],
} as const;

export const identifyCar = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CarGuess> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("El reconocimiento no está disponible ahora mismo.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Identifica el coche de la foto. Devuelve marca, modelo (con versión si se aprecia), año aproximado de la generación, precio aproximado de mercado en euros y unidades fabricadas si es un modelo limitado. Usa null cuando no puedas saberlo. Escribe la nota en español.",
              },
              {
                type: "input_image",
                image_url: `data:${data.mimeType};base64,${data.imageBase64}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "car_guess",
            strict: true,
            schema: carSchema,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Hay muchas peticiones ahora, inténtalo en un momento.");
      if (res.status === 402) throw new Error("No quedan créditos de IA para reconocer la foto.");
      console.error("identifyCar gateway error", res.status, body.slice(0, 500));
      throw new Error("No se ha podido reconocer el coche.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) {
            text += event.delta;
          } else if (event.type === "response.completed" && event.response?.output_text) {
            if (!text) text = event.response.output_text;
          }
        } catch {
          // ignora fragmentos no JSON
        }
      }
    }

    if (!text.trim()) throw new Error("El modelo no ha reconocido nada en la foto.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("No se ha podido leer la respuesta del modelo.");
    }

    const guess = parsed as Partial<CarGuess>;
    const num = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

    return {
      make: typeof guess.make === "string" && guess.make.trim() ? guess.make.trim() : null,
      model: typeof guess.model === "string" && guess.model.trim() ? guess.model.trim() : null,
      year_from: num(guess.year_from),
      price_eur: num(guess.price_eur),
      units_produced: num(guess.units_produced),
      confidence:
        guess.confidence === "alta" || guess.confidence === "baja" ? guess.confidence : "media",
      note: typeof guess.note === "string" ? guess.note : "",
    };
  });
