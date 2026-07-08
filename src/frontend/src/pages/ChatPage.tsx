import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ChatBot from '../components/organisms/ChatBot';
import ChatLauncher from '../components/molecules/ChatLauncher';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, easeFluid } from '../lib/motion';
import { Sparkles, ChefHat, MessageSquare, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/chat' } });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800">
      <div className="container pt-32 md:pt-40 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end mb-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={splitRevealLeft}
            className="lg:col-span-7"
          >
            <EyebrowTag>Trợ lý AI</EyebrowTag>
            <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Trò chuyện
              <br />
              <span className="text-[#ff4f00]">với AI.</span>
            </h1>
            <p className="mt-6 text-ink-secondary text-lg leading-relaxed max-w-md text-pretty">
              Đặt câu hỏi về công thức, nguyên liệu, hoặc gợi ý món ăn — AI sẽ trả lời trong vài giây.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={splitRevealRight}
            className="lg:col-span-5 lg:pb-3"
          >
            <motion.div
              variants={cardReveal}
              className="card-bezel"
            >
              <div className="card-bezel-inner p-6 bg-[#fff4ed]/40 dark:bg-[#ff4f00]/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#ff4f00] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light text-display">
                      CookSmart Assistant
                    </h3>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mt-1">
                      Powered by Gemini + RAG
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Tips / Suggestions Cards */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerGrid}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12"
        >
          {[
            {
              icon: MessageSquare,
              title: 'Hỏi công thức',
              description: 'Mô tả món ăn bạn muốn nấu, AI sẽ gợi ý cách làm chi tiết.',
              accent: 'bg-[#EDF3EC] text-[#346538]',
            },
            {
              icon: ChefHat,
              title: 'Tìm theo nguyên liệu',
              description: 'Liệt kê những gì bạn có trong tủ lạnh, AI gợi ý món phù hợp.',
              accent: 'bg-[#FBF3DB] text-[#956400]',
            },
            {
              icon: Wand2,
              title: 'Lập thực đơn',
              description: 'Nhờ AI xây dựng thực đơn tuần dựa trên sở thích và mục tiêu.',
              accent: 'bg-[#fff4ed] text-[#ff4f00]',
            },
          ].map((card, idx) => (
            <motion.div key={idx} custom={idx} variants={cardReveal}>
              <div className="card-bezel h-full">
                <div className="card-bezel-inner p-6">
                  <div className={`w-11 h-11 rounded-full ${card.accent} flex items-center justify-center mb-4`}>
                    <card.icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-display text-lg text-ink-primary dark:text-paper-light mb-2 text-balance">
                    {card.title}
                  </h3>
                  <p className="text-sm text-ink-secondary leading-relaxed text-pretty">
                    {card.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeFluid, delay: 0.4 }}
          className="card-bezel"
        >
          <div className="card-bezel-inner p-12 md:p-16 text-center bg-gradient-to-br from-paper-light to-[#fff4ed]/30 dark:from-ink-700/40 dark:to-[#ff4f00]/5">
            <Link to="/meal-plans" className="link-underline text-xs uppercase tracking-[0.2em] text-[#ff4f00] font-semibold mb-4 inline-block">
              Hoặc thử →
            </Link>
            <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-4 text-balance">
              Lập thực đơn tuần với AI
            </h2>
            <p className="text-ink-secondary text-lg max-w-md mx-auto text-pretty">
              Để AI gợi ý thực đơn 7 ngày phù hợp khẩu vị và ngân sách của bạn.
            </p>
          </div>
        </motion.div>
      </div>

      <ChatBot isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {!isOpen && <ChatLauncher isOpen={isOpen} onClick={() => setIsOpen(true)} />}
    </div>
  );
};

export default ChatPage;