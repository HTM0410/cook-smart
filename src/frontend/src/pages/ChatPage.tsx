import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatBot from '../components/organisms/ChatBot';
import { MessageSquare } from 'lucide-react';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/chat' } });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return <ChatBot isOpen={true} />;
};

export default ChatPage;
