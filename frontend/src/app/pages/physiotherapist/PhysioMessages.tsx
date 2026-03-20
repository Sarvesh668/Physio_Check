//E:\techfiesta_final\Physio_Check\frontend\src\app\pages\physiotherapist\PhysioMessages.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PhysiotherapistLayout } from '../../components/layouts/PhysiotherapistLayout';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { User, Send, Paperclip, Search, MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { toast } from 'sonner';

interface Patient {
  id: string;
  name: string;
  email: string;
  onboarding?: any;
  
}

interface Message {
  senderId: string;
  text: string;
  timestamp: any;
  type: string;
}

export function PhysioMessages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchPatients();
  }, [user?.id]);

  const fetchPatients = async () => {
    try {
      const response = await fetch(`https://physio-check.onrender.com/physiotherapist/patients/${user?.id}`);
      const data = await response.json();
      if (response.ok) {
        setPatients(data.patients);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error(t('physioMessages.loadPatientsFailed', 'Failed to load patients'));
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (!user || !selectedPatient) return;

    const initializeChat = async () => {
      setLoadingMessages(true);
      try {
        const response = await fetch('https://physio-check.onrender.com/chat/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: selectedPatient.id, physio_id: user.id })
        });
        const data = await response.json();
        if (data.chat_id) {
          setChatId(data.chat_id);
        }
      } catch (err) {
        console.error('Error initializing chat:', err);
        toast.error(t('messages.initFailed', 'Failed to initialize chat'));
      } finally {
        setLoadingMessages(false);
      }
    };

    initializeChat();
  }, [user, selectedPatient, t]);

  useEffect(() => {
    if (!chatId || !user) return;

    // Privacy check: roomId must contain current user ID
    if (!chatId.includes(user.id)) {
        toast.error(t('messages.unauthorized', "Unauthorized access to chat room"));
        return;
    }

    const db = getFirestoreDb();
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(msgs);
    }, (error) => {
      console.error("Error syncing messages:", error);
      toast.error(t('messages.syncFailed', "Failed to sync messages"));
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
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <PhysiotherapistLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-6">
        <Card className="w-80 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-4">{t('physioMessages.conversationsTitle', 'Patient Conversations')}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('common.searchPatients', 'Search patients...')} className="pl-9 h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingPatients ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={`w-full p-4 flex gap-3 hover:bg-muted transition-colors text-left ${
                  selectedPatient?.id === patient.id ? 'bg-primary/5 border-r-4 border-primary' : ''
                }`}
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold shrink-0">
                    {patient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{patient.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{patient.email}</p>
                </div>
              </button>
            ))}
            {!loadingPatients && patients.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                    {t('physioMessages.noLinkedPatients', 'No linked patients found.')}
                </div>
            )}
          </div>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden">
          {selectedPatient ? (
            <>
              <div className="p-4 border-b flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedPatient.name}</p>
                    <p className="text-xs text-green-600">{t('common.online', 'Online')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
                {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        {t('messages.noMessages', 'No messages yet.')}
                    </div>
                ) : messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.senderId === user?.id ? 'bg-primary text-white' : 'bg-white border shadow-sm'
                    }`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${
                        msg.senderId === user?.id ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                      }`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon"><Paperclip className="w-4 h-4" /></Button>
                  <Input
                    placeholder={t('messages.typePlaceholder', 'Type a message...')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>{t('physioMessages.selectPatient', 'Select a patient to start messaging')}</p>
            </div>
          )}
        </Card>
      </div>
    </PhysiotherapistLayout>
  );
}
