import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    streamText,
    UIMessage,
} from 'ai';
import { google } from "@ai-sdk/google";
import dedent from "dedent";

const FALLBACK_RESPONSE =
    'I found a few matching products from the demo catalog. Review the product cards below and save anything you want to revisit.';

function createMissingApiKeyFallbackResponse() {
    return createUIMessageStreamResponse({
        stream: createUIMessageStream({
            execute({ writer }) {
                writer.write({ type: 'start' });
                writer.write({ type: 'text-start', id: 'fallback-response' });
                writer.write({
                    type: 'text-delta',
                    id: 'fallback-response',
                    delta: FALLBACK_RESPONSE,
                });
                writer.write({ type: 'text-end', id: 'fallback-response' });
            },
        }),
    });
}

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return createMissingApiKeyFallbackResponse();
    }

    const result = streamText({
        system: dedent`
            System Role: You are a specialized AI Search Concierge. Your goal is to help users find the most relevant items from our catalog based on their intent, preferences, and constraints.
            Core Operational Guidelines:
            Analyze Intent: Determine if the user is looking for a specific product, browsing a category, or seeking a solution to a problem.
            Contextual Filtering: Prioritize results that match the user’s described needs (e.g., size, color, use case).
            Conciseness: Provide brief, helpful descriptions of why a result matches their query.
            [SHOP_SPECIFIC_INSTRUCTIONS] Insert specific shop rules here (e.g., "Always prioritize eco-friendly products" or "Focus on high-performance athletic gear").
            Output Format:
            Acknowledge the request.
            Present the top 3–5 matches with a brief "Why this fits" note for each.
            Suggest one related item or accessory.`,
        model: google("gemini-2.5-flash"),
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
