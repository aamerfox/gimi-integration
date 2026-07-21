import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/Colors';
import axios from 'axios';

// Airia Copilot Screen
export default function CopilotScreen() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([
    { role: 'agent', content: t('copilot_welcome', 'Hello! I am your AI Copilot. How can I help you manage your fleet today?') }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      // In a real integration, this calls the Airia /v1/Chats API endpoint
      // using an agent id and the user's specific access token or workspace context.
        const response = await axios.post(
          'https://api.airia.ai/v1/Chats/execute', 
          { 
            agentId: 'saudiex',
            message: userMessage,
            metadata: {
              ociToken: 'YOUR_OCI_AUTH_TOKEN' // In real app, fetch from Zustand useAuthStore()
            }
          },
          { 
            headers: { 
              'X-API-Key': `YOUR_AIRIA_API_KEY`,
              'Content-Type': 'application/json'
            }
          }
        );

        setMessages(prev => [...prev, { 
          role: 'agent', 
          content: response.data.message || 'Action completed.' 
        }]);
        setIsLoading(false);
      
    } catch (error) {
      console.error('Copilot Error:', error);
      setMessages(prev => [...prev, { role: 'agent', content: t('copilot_error', 'Sorry, I encountered an error connecting to the AI brain.') }]);
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AI Copilot</Text>
      </View>

      <ScrollView style={styles.chatArea} contentContainerStyle={{ paddingVertical: 20 }}>
        {messages.map((msg, idx) => (
          <View key={idx} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.agentBubble]}>
            <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.agentText]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.agentBubble]}>
            <ActivityIndicator color={COLORS.light.tint} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('copilot_placeholder', 'Ask about your vehicles...')}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isLoading}>
          <Ionicons name="send" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.light.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.light.text,
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.light.tint,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  agentText: {
    color: '#333333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: COLORS.light.tint,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
