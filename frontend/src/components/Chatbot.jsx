import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, ExternalLink, MessageSquare, RotateCcw, Search, Send, Sparkles, X } from 'lucide-react';
import api from '../services/api';

const STORAGE_KEY = 'medprice-chat-history';
const DEFAULT_MESSAGE = {
    role: 'assistant',
    content: 'I am your MedPrice assistant. I can help with prices, generic alternatives, precautions, refill planning, and shopping tips.',
    suggestions: [
        'Compare Dolo 650 prices',
        'Show alternatives for Crocin',
        'How can I reduce monthly medicine costs?',
    ],
    actions: [
        { type: 'search_medicine', label: 'Search Dolo 650', payload: 'Dolo 650' },
    ],
    intent: 'general',
};

const STARTER_TOPICS = [
    { label: 'Price Help', prompt: 'Compare Dolo 650 prices and tell me if this is a good time to buy.' },
    { label: 'Alternatives', prompt: 'What are the best generic alternatives for Crocin?' },
    { label: 'Precautions', prompt: 'When should I ask a pharmacist before switching medicines?' },
    { label: 'Savings', prompt: 'How can I save money on monthly medicine purchases?' },
];

const Chatbot = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [DEFAULT_MESSAGE];
        } catch (error) {
            return [DEFAULT_MESSAGE];
        }
    });
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, [messages]);

    const triggerSearch = (query) => {
        if (!query) {
            return;
        }

        if (location.pathname !== '/') {
            navigate('/');
        }

        window.dispatchEvent(new CustomEvent('medprice-chat-search', { detail: { query } }));
        setIsOpen(false);
    };

    const handleAction = (action) => {
        if (!action) {
            return;
        }

        if (action.type === 'search_medicine' || action.type === 'compare_basket' || action.type === 'show_alternatives') {
            triggerSearch(action.payload);
            return;
        }

        if (action.type === 'suggest_prompt' && action.payload) {
            setInput(action.payload);
        }
    };

    const sendPrompt = async (promptText) => {
        if (!promptText.trim()) {
            return;
        }

        const userMessage = { role: 'user', content: promptText.trim() };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsTyping(true);

        try {
            const response = await api.chat(nextMessages);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: response.reply,
                    suggestions: response.suggestions || [],
                    actions: response.actions || [],
                    safety_note: response.safety_note || null,
                    intent: response.intent || 'general',
                    extracted_medicines: response.extracted_medicines || [],
                },
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: "Sorry, I'm having trouble connecting right now.",
                    suggestions: ['Try asking again', 'Search a medicine directly'],
                    actions: [],
                    intent: 'general',
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        await sendPrompt(input);
    };

    const clearConversation = () => {
        setMessages([DEFAULT_MESSAGE]);
        setInput('');
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all z-50 transform hover:scale-105 ${isOpen ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gradient-to-r from-brand-500 to-sky-500 text-white'}`}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 w-80 sm:w-[26rem] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 overflow-hidden animate-fade-in" style={{ height: '560px', maxHeight: '82vh' }}>
                    <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-4 text-white flex items-center justify-between shadow-md z-10">
                        <div className="flex items-center">
                            <div className="bg-white/20 p-2 rounded-full mr-3 backdrop-blur-sm">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">MedPrice Assistant</h3>
                                <p className="text-xs text-brand-100 font-medium">Advanced shopping and medicine guidance</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={clearConversation}
                            className="rounded-full bg-white/15 p-2 transition-colors hover:bg-white/25"
                            title="Clear chat"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>

                    <div className="border-b border-gray-100 bg-white px-3 py-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            <Sparkles size={13} />
                            Starter Topics
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {STARTER_TOPICS.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => setInput(item.prompt)}
                                    className="rounded-full border border-gray-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        <div className="rounded-2xl border border-brand-100 bg-white/80 p-3 text-xs leading-5 text-slate-600">
                            I can explain prices, generics, refill planning, medicine-shopping strategy, and common precautions.
                            For emergencies, pregnancy, child dosing, severe reactions, overdose concerns, or medicine interactions, please contact a doctor or pharmacist.
                        </div>

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-brand-500 text-white rounded-br-sm shadow-sm'
                                        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
                                    }`}>
                                        {msg.content}
                                    </div>

                                    {msg.role === 'assistant' && msg.safety_note ? (
                                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            {msg.safety_note}
                                        </div>
                                    ) : null}

                                    {msg.role === 'assistant' && msg.actions?.length ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {msg.actions.map((action, actionIndex) => (
                                                <button
                                                    key={`${action.label}-${actionIndex}`}
                                                    type="button"
                                                    onClick={() => handleAction(action)}
                                                    className="inline-flex items-center rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                                                >
                                                    {action.type === 'search_medicine' || action.type === 'compare_basket' || action.type === 'show_alternatives' ? (
                                                        <Search size={12} className="mr-1.5" />
                                                    ) : (
                                                        <ExternalLink size={12} className="mr-1.5" />
                                                    )}
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {msg.role === 'assistant' && msg.suggestions?.length ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {msg.suggestions.map((suggestion, suggestionIndex) => (
                                                <button
                                                    key={`${suggestion}-${suggestionIndex}`}
                                                    type="button"
                                                    onClick={() => setInput(suggestion)}
                                                    className="rounded-full bg-slate-200 px-3 py-1 text-[11px] text-slate-700 transition-colors hover:bg-slate-300"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white text-gray-500 p-3 rounded-2xl rounded-bl-sm border border-gray-100 shadow-sm flex space-x-1.5 items-center">
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex items-center space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about prices, alternatives, timing, or safety..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-2.5 bg-brand-500 text-white rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={18} className="ml-0.5" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default Chatbot;
