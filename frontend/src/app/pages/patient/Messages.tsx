//E:\techfiesta_final\Physio_Check\frontend\src\app\pages\patient\Messages.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientLayout } from '../../components/layouts/PatientLayout';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Send, Paperclip, User, Search, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { toast } from 'sonner';

interface Message {
  senderId: string;
  text: string;
  timestamp: any;
  type: string;
}

export function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !user.physio_id) {
        setLoading(false);
        return;
    }

    const initializeChat = async () => {
      try {
        const response = await fetch('https://physio-check.onrender.com/chat/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: user.id, physio_id: user.physio_id })
        });
        const data = await response.json();
        if (data.chat_id) {
          setChatId(data.chat_id);
        }
      } catch (err) {
        console.error('Error initializing chat:', err);
        toast.error(t('messages.initFailed', 'Failed to initialize chat'));
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [user, t]);

  useEffect(() => {
    if (!chatId || !user) return;

    // Verify privacy: roomId must contain user.id
    if (!chatId.includes(user.id)) {
        toast.error(t('messages.unauthorized', 'Unauthorized access to chat room'));
        return;
    }

    const db = getFirestoreDb();
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(msgs);
    }, (error) => {
      console.error("Error listening to messages:", error);
      toast.error(t('messages.syncFailed', 'Failed to sync messages'));
    });

    return () => unsubscribe();
  }, [chatId, user?.id, t]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !user) return;

    const text = newMessage;
    setNewMessage('');

    try {
      await fetch('https://physio-check.onrender.com/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          sender_id: user.id,
          text: text,
          type: 'text'
        })
      });
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error(t('messages.sendFailed', 'Failed to send message'));
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!user?.physio_id) {
      return (
          <PatientLayout>
              <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center">
                  <User className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h2 className="text-xl font-bold mb-2">{t('messages.noPhysioTitle', 'No Physiotherapist Assigned')}</h2>
                  <p className="text-muted-foreground">{t('messages.noPhysioSub', 'Please choose a physiotherapist to start chatting.')}</p>
                  <Button className="mt-4" onClick={() => window.location.href = '/choose-physio'}>{t('messages.choosePhysioBtn', 'Choose Physiotherapist')}</Button>
              </div>
          </PatientLayout>
      );
  }

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-12"
          >
            <Card className="h-[calc(100vh-12rem)] flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    P
                  </div>
                  <div>
                    <p className="font-medium">{t('messages.yourPhysio', 'Your Physiotherapist')}</p>
                    <p className="text-xs text-green-600">{t('common.online', 'Online')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {t('messages.noMessages', 'No messages yet. Say hi!')}
                    </div>
                ) : messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${
                      message.senderId === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      message.senderId === user?.id ? 'bg-primary text-white' : 'bg-white border shadow-sm'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      <p className={`text-[10px] mt-1 ${
                        message.senderId === user?.id ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-white">
                <div className="flex gap-3">
                  <Button type="button" variant="outline" size="icon"><Paperclip className="w-5 h-5" /></Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('messages.typePlaceholder', 'Type your message...')}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </PatientLayout>
  );
}
