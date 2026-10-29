import { http } from './http';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isError?: boolean;
  retryText?: string;
}

export async function askChatbot(question: string): Promise<string> {
  try {
    const response = await http.post<string>('/chat/ask', question, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Chatbot API error:', error);
    throw error;
  }
}
