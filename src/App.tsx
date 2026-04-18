import React, { useState, useEffect, useRef } from 'react';
import { 
  Dumbbell, Utensils, Briefcase, Target, ChevronDown, ChevronUp, 
  TrendingUp, CalendarDays, History, Bell, LogIn, LogOut, Search, Plus, CheckCircle2, Apple,
  Camera, GripVertical, Edit2, Trash2, CheckSquare, X, ArrowUp, ArrowDown,
  Timer, BookOpen, Wind, Waves, Footprints, Calendar, Sparkles, Send, Bot, User, Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, query, where, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { WORKOUT_SPLIT } from './workoutData';
import { GoogleGenAI } from "@google/genai";
import Markdown from "react-markdown";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

function AIChatWidget({ contextData }: { contextData: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is required.");
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `You are LifeOS, an elite AI coach focusing on productivity, fitness, macros, lifts, and goal timelines. 
      You are speaking directly to your user. Keep responses concise, direct, and actionable. Avoid long generic spiels.

      Here is their current data context:
      ${JSON.stringify(contextData, null, 2)}`;

      const model = 'gemini-3-flash-preview';

      const promptText = `User says: ${userMessage}`;
      
      // We pass the whole conversation history as a formatted document or pass previous content.
      // But for simplicity in this widget, we'll just send a single query with context, since the system prompt handles context.
      // Easiest is to just format the chat history.
      const chatHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`).join('\n\n');
      
      const fullContents = chatHistory ? `${chatHistory}\n\n${promptText}` : promptText;

      const response = await ai.models.generateContent({
        model,
        contents: fullContents,
        config: { systemInstruction }
      });

      if (response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text as string }]);
      }
    } catch (err) {
      console.error("AI Chat Error:", err);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error analyzing your data. Please check my configuration or try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 w-14 h-14 bg-[#C5A059] text-black rounded-full shadow-[0_0_20px_rgba(197,160,89,0.3)] flex items-center justify-center transition-transform hover:scale-110 z-30",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-[#121212] border border-[#C5A059]/30 rounded-2xl shadow-2xl flex flex-col z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#1C1C1C] to-[#121212] rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#C5A059]" />
              <span className="font-serif text-white text-lg">LifeOS AI</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#8E8E8E] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center text-[#8E8E8E] text-[13px] mt-10">
                <Bot className="w-8 h-8 text-[#C5A059]/50 mx-auto mb-3" />
                <p>Hello! I'm your optimal flow coach.</p>
                <p className="mt-1 opacity-70">Ask me about your macros, lifting progress, or goals.</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", msg.role === 'user' ? "bg-white/10" : "bg-[#C5A059]/20")}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-[#C5A059]" />}
                </div>
                <div className={cn("max-w-[75%] rounded-2xl px-4 py-2", msg.role === 'user' ? "bg-white/10 text-white rounded-tr-sm" : "bg-[#1C1C1C] border border-[#C5A059]/20 text-[#E0E0E0] rounded-tl-sm text-[14px]")}>
                  {msg.role === 'model' ? (
                    <div className="markdown-body prose prose-invert prose-sm max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  ) : (
                    <p className="text-[14px]">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 text-[#C5A059] animate-spin" />
                </div>
                <div className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center">
                  <span className="text-[#8E8E8E] text-[13px]">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 bg-[#080808] rounded-b-2xl">
            <div className="flex items-center gap-2 bg-[#1C1C1C] border border-white/10 rounded-xl px-2 py-1">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your progress..."
                className="flex-1 bg-transparent border-none text-white text-[13px] px-2 py-2 focus:outline-none placeholder-[#8E8E8E]"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="w-8 h-8 bg-[#C5A059] text-black rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ExpandableCard({ 
  title, icon: Icon, children, defaultExpanded = false, status = "Active Now", completed, onToggleCompleted
}: { 
  title: string; icon: React.ElementType; children: React.ReactNode; defaultExpanded?: boolean; status?: string;
  completed?: boolean; onToggleCompleted?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden mb-6 transition-all duration-300",
      isExpanded 
        ? "border-[#C5A059] bg-gradient-to-br from-[#121212] to-[#1a1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
        : completed
          ? "border-white/5 bg-[#0a0a0a] opacity-60 hover:opacity-100"
          : "border-white/10 bg-[#121212]"
    )}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-5 flex items-center justify-between bg-transparent hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          {onToggleCompleted && (
            <div 
              onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }}
              className={cn("w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all", completed ? "bg-[#C5A059] border-[#C5A059]" : "border-white/30 hover:border-[#C5A059]")}
            >
              {completed && <CheckCircle2 className="w-4 h-4 text-black" />}
            </div>
          )}
          <Icon className={cn("w-5 h-5", completed ? "text-[#8E8E8E]" : "text-[#C5A059]")} />
          <h3 className={cn("font-serif text-[22px]", completed ? "text-[#8E8E8E] line-through decoration-white/20" : "text-white")}>{title}</h3>
        </div>
        <div className="flex items-center gap-4">
          <span className={cn("text-[11px] uppercase tracking-[1px]", isExpanded ? "text-[#C5A059]" : "text-[#8E8E8E]")}>
            {status}
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-[#8E8E8E]" /> : <ChevronDown className="w-5 h-5 text-[#8E8E8E]" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-5 pb-5 pt-0 border-t border-white/10 animate-in slide-in-from-top-2 fade-in duration-200 mt-2">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ current, target, label, unit = "" }: { current: number, target: number, label: string, unit?: string }) {
  const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-[12px] mb-2 text-[#8E8E8E]">
        <span>{label}</span>
        <span>{current} / {target} {unit} ({percentage}%)</span>
      </div>
      <div className="w-full bg-[#1C1C1C] rounded-full h-1">
        <div className="bg-[#C5A059] h-1 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

type FoodItem = { name: string; calories: number; protein: number; carbs: number; fats: number };
type Meal = { title: string; items: string[]; macros: { calories: number; protein: number; carbs: number; fats: number } };
type MealPlan = Meal[];

type ScheduleItem = { id: string; time: string; title: string; type: string; icon?: string };
type Goal = { id: string; title: string; current: number; target: number; unit: string; deadline: string; startDate: string; systemPlan?: string; };
type Task = { id: string; title: string; completed: boolean };
type FutureEvent = { id: string; date: string; title: string; description: string };

const TRAINING_MEAL_PLAN: MealPlan = [
  { title: 'Meal 1', items: ['3 whole eggs', '1 oikos triple zero Greek yogurt', '1 (Thomas) English muffin', '100g raspberry'], macros: { calories: 480, protein: 38, carbs: 48, fats: 16 } },
  { title: 'Meal 2', items: ['5 oz chicken breast', '100g jasmine rice', '50g green beans'], macros: { calories: 380, protein: 47, carbs: 31, fats: 5 } },
  { title: 'Meal 3', items: ['5 oz 90/10 ground beef', '100g jasmine rice', '50g green beans'], macros: { calories: 395, protein: 33, carbs: 31, fats: 14 } },
  { title: 'Pre-workout', items: ['2 scoops whey isolate', '1 serving Frosted Flakes', '50g banana', '10g peanut butter'], macros: { calories: 455, protein: 54, carbs: 45, fats: 7 } },
  { title: 'Intra-workout', items: ['25g carbs cyclic dextrin'], macros: { calories: 100, protein: 0, carbs: 25, fats: 0 } },
  { title: 'Post-workout', items: ['5 oz chicken breast', '200g jasmine rice'], macros: { calories: 495, protein: 49, carbs: 56, fats: 6 } }
];

const REST_MEAL_PLAN: MealPlan = [
  { title: 'Meal 1', items: ['3 whole eggs', '1 oikos triple zero Greek yogurt', '1 (Thomas) English muffin', '100g raspberry'], macros: { calories: 480, protein: 38, carbs: 48, fats: 16 } },
  { title: 'Meal 2', items: ['5 oz chicken breast', '50g jasmine rice', '50g green beans'], macros: { calories: 310, protein: 46, carbs: 17, fats: 5 } },
  { title: 'Meal 3', items: ['5 oz 90/10 ground beef', '50g jasmine rice', '50g green beans'], macros: { calories: 325, protein: 32, carbs: 17, fats: 14 } },
  { title: 'Meal 4', items: ['2 scoops whey isolate', '1 serving Frosted Flakes', '10g peanut butter'], macros: { calories: 410, protein: 53, carbs: 34, fats: 7 } },
  { title: 'Meal 5', items: ['5 oz chicken breast', '200g jasmine rice', '50g avocado'], macros: { calories: 575, protein: 50, carbs: 56, fats: 15 } }
];

const ACTIVITY_TYPES = [
  { type: 'routine', title: 'Morning Routine', icon: Target },
  { type: 'breakfast', title: 'Breakfast', icon: Utensils },
  { type: 'lunch', title: 'Lunch', icon: Utensils },
  { type: 'dinner', title: 'Dinner', icon: Utensils },
  { type: 'work', title: 'Deep Work', icon: Briefcase },
  { type: 'admin', title: 'Admin', icon: Briefcase },
  { type: 'training', title: 'Training', icon: Dumbbell },
  { type: 'side_hustle', title: 'Side Hustle', icon: TrendingUp },
  { type: 'running', title: 'Running', icon: Footprints },
  { type: 'swimming', title: 'Swimming', icon: Waves },
  { type: 'studying', title: 'Studying', icon: BookOpen },
  { type: 'meditating', title: 'Meditating', icon: Wind },
  { type: 'pre_workout', title: 'Pre-Workout Meal', icon: Utensils },
  { type: 'post_workout', title: 'Post-Workout Meal', icon: Utensils },
  { type: 'custom', title: 'Custom Activity', icon: Timer },
];

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: '1', time: '06:30', title: 'Morning Routine', type: 'routine' },
  { id: '2', time: '07:30', title: 'Breakfast', type: 'breakfast' },
  { id: '3', time: '09:00', title: 'Deep Work: Focus Block', type: 'work' },
  { id: '4', time: '13:00', title: 'Lunch Break', type: 'lunch' },
  { id: '5', time: '14:00', title: 'Meetings & Admin', type: 'admin' },
  { id: '9', time: '15:30', title: 'Pre-Workout Meal', type: 'pre_workout' },
  { id: '6', time: '17:00', title: 'Training', type: 'training' },
  { id: '10', time: '18:30', title: 'Post-Workout Meal', type: 'post_workout' },
  { id: '7', time: '19:30', title: 'Dinner', type: 'dinner' },
  { id: '8', time: '21:00', title: 'Side Hustles', type: 'side_hustle' }
];

const DEFAULT_GOALS: Goal[] = [
  { id: '1', title: '911 Porsche Fund', current: 82000, target: 100000, unit: '$', startDate: '2025-01-01', deadline: '2026-12-31' },
  { id: '2', title: 'App Launch (V1.2)', current: 45, target: 100, unit: '%', startDate: '2026-03-01', deadline: '2026-05-01' },
  { id: '3', title: 'Personal Spanish B2', current: 68, target: 100, unit: '%', startDate: '2026-01-01', deadline: '2026-06-01' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'food' | 'goals' | 'history'>('schedule');
  const [user, setUser] = useState(auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // User Profile State
  const [trainingBlock, setTrainingBlock] = useState<'strength' | 'growth'>('strength');
  const [currentSplitIndex, setCurrentSplitIndex] = useState(new Date().getDay()); 
  const [pushEnabled, setPushEnabled] = useState(false);
  const [targetMacros, setTargetMacros] = useState({ calories: 2500, protein: 180, carbs: 250, fats: 80 });
  const [scheduleTemplate, setScheduleTemplate] = useState<ScheduleItem[]>(DEFAULT_SCHEDULE);
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [futureEvents, setFutureEvents] = useState<FutureEvent[]>([]);
  const [macroOffsets, setMacroOffsets] = useState({ carbs: 0, fats: 0 });
  const [currentGoal, setCurrentGoal] = useState<'cut' | 'maintain' | 'bulk'>('maintain');
  const [targetWeight, setTargetWeight] = useState<number>(180);
  const [targetWeightDate, setTargetWeightDate] = useState<string>(new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]);
  const [trainingMealPlan, setTrainingMealPlan] = useState<MealPlan>(TRAINING_MEAL_PLAN);
  const [restMealPlan, setRestMealPlan] = useState<MealPlan>(REST_MEAL_PLAN);
  const [workoutSplit, setWorkoutSplit] = useState(WORKOUT_SPLIT);

  // Daily Log State
  const [dailyWeight, setDailyWeight] = useState<number | ''>('');
  const [checkInPhotos, setCheckInPhotos] = useState<string[]>([]);
  const [dailyNotes, setDailyNotes] = useState('');
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [dailyKpis, setDailyKpis] = useState<Record<string, { id: string, name: string, value: string, target: string }[]>>({});
  const [completedBlocks, setCompletedBlocks] = useState<Record<string, boolean>>({});

  
  // History State
  const [checkInHistory, setCheckInHistory] = useState<{ date: string; weight: number; photos: string[]; notes?: string }[]>([]);

  // Workout State
  const [loggedExercises, setLoggedExercises] = useState<Record<string, { weight: string, reps: string }>>({});

  // UI State
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', title: '', description: '' });
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showCheckinDropdown, setShowCheckinDropdown] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [isEditingMealPlan, setIsEditingMealPlan] = useState(false);
  const [isEditingWorkoutSplit, setIsEditingWorkoutSplit] = useState(false);

  // Debounce timers
  const debounceTimers = useRef<Record<string, any>>({});

  const debounceUpdate = (key: string, fn: () => void, delay = 1000) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const today = new Date().toISOString().split('T')[0];
    const userRef = doc(db, 'users', user.uid);
    const dailyLogRef = doc(db, 'dailyLogs', `${user.uid}_${today}`);
    const workoutLogRef = doc(db, 'workoutLogs', `${user.uid}_${today}`);

    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTrainingBlock(data.trainingBlock || 'strength');
        setCurrentSplitIndex(data.currentSplitIndex || 0);
        setPushEnabled(data.pushNotificationsEnabled || false);
        if (data.targetCalories) setTargetMacros({
          calories: data.targetCalories, protein: data.targetProtein, carbs: data.targetCarbs, fats: data.targetFats
        });
        if (data.scheduleTemplate) setScheduleTemplate(data.scheduleTemplate);
        if (data.goals) setGoals(data.goals);
        if (data.macroOffsets) setMacroOffsets(data.macroOffsets);
        if (data.currentGoal) setCurrentGoal(data.currentGoal);
        if (data.targetWeight) setTargetWeight(data.targetWeight);
        if (data.targetWeightDate) setTargetWeightDate(data.targetWeightDate);
        if (data.trainingMealPlan) setTrainingMealPlan(data.trainingMealPlan);
        if (data.restMealPlan) setRestMealPlan(data.restMealPlan);
        if (data.workoutSplit) setWorkoutSplit(data.workoutSplit);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubDaily = onSnapshot(dailyLogRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDailyWeight(data.weight || '');
        if (data.checkInPhotos) setCheckInPhotos(data.checkInPhotos);
        if (data.notes) setDailyNotes(data.notes);
        if (data.tasks) setTasks(data.tasks);
        if (data.dailyKpis) setDailyKpis(data.dailyKpis);
        if (data.completedBlocks) setCompletedBlocks(data.completedBlocks);
      } else {
        setDailyWeight('');
        setCheckInPhotos([]);
        setDailyNotes('');
        setTasks({});
        setDailyKpis({});
        setCompletedBlocks({});
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    const unsubWorkout = onSnapshot(workoutLogRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.loggedExercises) setLoggedExercises(data.loggedExercises);
      } else {
        setLoggedExercises({});
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'workoutLogs'));

    // Fetch Future Events
    const eventsQuery = query(collection(db, 'futureEvents'), where('uid', '==', user.uid), orderBy('date', 'asc'));
    const unsubEvents = onSnapshot(eventsQuery, (snap) => {
      setFutureEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FutureEvent)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'futureEvents'));

    // Fetch Check-in History (last 30 days)
    const historyQuery = query(collection(db, 'dailyLogs'), where('uid', '==', user.uid), orderBy('date', 'desc'), limit(30));
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      const history = snap.docs.map(doc => ({
        date: doc.data().date,
        weight: doc.data().weight,
        photos: doc.data().checkInPhotos || [],
        notes: doc.data().notes
      })).filter(h => h.weight || (h.photos && h.photos.length > 0));
      setCheckInHistory(history);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    return () => { unsubUser(); unsubDaily(); unsubWorkout(); unsubEvents(); unsubHistory(); };
  }, [user, isAuthReady, currentSplitIndex]);

  const addFutureEvent = async () => {
    if (!user || !newEvent.date || !newEvent.title) return;
    try {
      const eventId = Date.now().toString();
      await setDoc(doc(db, 'futureEvents', eventId), { ...newEvent, uid: user.uid, id: eventId });
      setShowEventModal(false);
      setNewEvent({ date: '', title: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'futureEvents');
    }
  };

  const deleteFutureEvent = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'futureEvents', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'futureEvents');
    }
  };

  const updateDailyLog = async (field: string, value: any, debounce = false) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const update = async () => {
      try {
        await setDoc(doc(db, 'dailyLogs', `${user.uid}_${today}`), { 
          uid: user.uid,
          date: today,
          [field]: value 
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'dailyLogs');
      }
    };

    if (debounce) {
      debounceUpdate(`dailyLog_${field}`, update);
    } else {
      update();
    }
  };

  const updateUserProfile = async (field: string, value: any, debounce = false) => {
    if (!user) return;
    const update = async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          uid: user.uid,
          trainingBlock,
          currentSplitIndex,
          [field]: value 
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users');
      }
    };

    if (debounce) {
      debounceUpdate(`userProfile_${field}`, update);
    } else {
      update();
    }
  };

  const updateWorkoutLog = async (exercises: Record<string, { weight: string, reps: string }>, debounce = true) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const currentWorkout = workoutSplit[currentSplitIndex % workoutSplit.length];
    
    const update = async () => {
      try {
        await setDoc(doc(db, 'workoutLogs', `${user.uid}_${today}`), { 
          uid: user.uid,
          date: today,
          splitName: currentWorkout.day,
          loggedExercises: exercises 
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'workoutLogs');
      }
    };

    if (debounce) {
      debounceUpdate('workoutLog', update);
    } else {
      update();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setCheckInPhotos(prev => {
            const next = [...prev, base64];
            updateDailyLog('checkInPhotos', next);
            return next;
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    const next = checkInPhotos.filter((_, i) => i !== index);
    setCheckInPhotos(next);
    updateDailyLog('checkInPhotos', next);
  };

  const moveScheduleItem = (index: number, direction: 'up' | 'down') => {
    const newSchedule = [...scheduleTemplate];
    if (direction === 'up' && index > 0) {
      [newSchedule[index - 1], newSchedule[index]] = [newSchedule[index], newSchedule[index - 1]];
    } else if (direction === 'down' && index < newSchedule.length - 1) {
      [newSchedule[index + 1], newSchedule[index]] = [newSchedule[index], newSchedule[index + 1]];
    }
    setScheduleTemplate(newSchedule);
    updateUserProfile('scheduleTemplate', newSchedule);
  };

  const addScheduleItem = (activityType: string) => {
    const typeInfo = ACTIVITY_TYPES.find(a => a.type === activityType) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
    const newItem: ScheduleItem = { 
      id: Date.now().toString(), 
      time: '12:00', 
      title: typeInfo.title, 
      type: activityType 
    };
    const newSchedule = [...scheduleTemplate, newItem].sort((a, b) => a.time.localeCompare(b.time));
    setScheduleTemplate(newSchedule);
    updateUserProfile('scheduleTemplate', newSchedule);
    setShowActivityPicker(false);
  };

  const removeScheduleItem = (id: string) => {
    const newSchedule = scheduleTemplate.filter(item => item.id !== id);
    setScheduleTemplate(newSchedule);
    updateUserProfile('scheduleTemplate', newSchedule);
  };

  const updateScheduleItem = (id: string, field: keyof ScheduleItem, value: string) => {
    const newSchedule = scheduleTemplate.map(item => item.id === id ? { ...item, [field]: value } : item);
    setScheduleTemplate(newSchedule);
    updateUserProfile('scheduleTemplate', newSchedule);
  };

  const addTask = (sectionId: string, title: string) => {
    if (!title) return;
    const sectionTasks = tasks[sectionId] || [];
    const newTasks = { ...tasks, [sectionId]: [...sectionTasks, { id: Date.now().toString(), title, completed: false }] };
    setTasks(newTasks);
    updateDailyLog('tasks', newTasks);
  };

  const toggleTask = (sectionId: string, taskId: string) => {
    const sectionTasks = tasks[sectionId] || [];
    const newTasks = { ...tasks, [sectionId]: sectionTasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) };
    setTasks(newTasks);
    updateDailyLog('tasks', newTasks);
  };

  const removeTask = (sectionId: string, taskId: string) => {
    if (!tasks[sectionId]) return;
    const newTasks = { ...tasks, [sectionId]: tasks[sectionId].filter(t => t.id !== taskId) };
    setTasks(newTasks);
    updateDailyLog('tasks', newTasks);
  };

  const addKpi = (sectionId: string, name: string) => {
    if (!name.trim()) return;
    const newKpis = { ...dailyKpis };
    if (!newKpis[sectionId]) newKpis[sectionId] = [];
    newKpis[sectionId].push({ id: Date.now().toString(), name: name.trim(), value: '0', target: '0' });
    setDailyKpis(newKpis);
    updateDailyLog('dailyKpis', newKpis);
  };

  const updateKpi = (sectionId: string, kpiId: string, field: 'name' | 'value' | 'target', val: string) => {
    const newKpis = { ...dailyKpis };
    if (!newKpis[sectionId]) return;
    const idx = newKpis[sectionId].findIndex(k => k.id === kpiId);
    if (idx > -1) {
      newKpis[sectionId][idx][field] = val;
      setDailyKpis(newKpis);
      updateDailyLog('dailyKpis', newKpis, true);
    }
  };

  const removeKpi = (sectionId: string, kpiId: string) => {
    const newKpis = { ...dailyKpis };
    if (!newKpis[sectionId]) return;
    newKpis[sectionId] = newKpis[sectionId].filter(k => k.id !== kpiId);
    setDailyKpis(newKpis);
    updateDailyLog('dailyKpis', newKpis);
  };

  const toggleBlockCompletion = (blockId: string) => {
    const newBlocks = { ...completedBlocks, [blockId]: !completedBlocks[blockId] };
    setCompletedBlocks(newBlocks);
    updateDailyLog('completedBlocks', newBlocks);
  };

  const calculateGoalProgress = (goal: Goal) => {
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.deadline).getTime();
    const now = new Date().getTime();
    
    const totalDuration = end - start;
    const elapsed = now - start;
    const expectedPercentage = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
    
    const actualPercentage = (goal.current / goal.target) * 100;
    const difference = actualPercentage - expectedPercentage;
    
    return {
      percentage: Math.min(Math.round(actualPercentage), 100),
      ahead: difference > 0,
      difference: Math.abs(Math.round(difference))
    };
  };

  const currentWorkout = workoutSplit[currentSplitIndex % workoutSplit.length];
  const isTrainingDay = currentWorkout.exercises.length > 0;
  const baseMealPlan = isTrainingDay ? trainingMealPlan : restMealPlan;

  const [isCalculatingMacrosForMeal, setIsCalculatingMacrosForMeal] = useState<{plan: 'training' | 'rest', idx: number} | null>(null);

  const calculateMealMacrosWithAI = async (planType: 'training' | 'rest', idx: number) => {
    try {
      setIsCalculatingMacrosForMeal({ plan: planType, idx });
      const plan = planType === 'training' ? trainingMealPlan : restMealPlan;
      const meal = plan[idx];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these food items and estimate the total macros (calories, protein, carbs, fats) for the combined meal. Return ONLY a raw JSON object with the keys "calories", "protein", "carbs" and "fats" with number values. No markdown wrapping. Items:\n${meal.items.join('\n')}`,
      });
      
      if (response.text) {
        let text = response.text.trim();
        if (text.startsWith('\`\`\`json')) {
          text = text.substring(7);
          text = text.substring(0, text.length - 3);
        }
        text = text.trim();
        const parsed = JSON.parse(text);
        
        if (parsed && typeof parsed.calories === 'number') {
           const newPlan = [...plan];
           newPlan[idx].macros = {
             calories: Math.round(parsed.calories),
             protein: Math.round(parsed.protein),
             carbs: Math.round(parsed.carbs),
             fats: Math.round(parsed.fats)
           };
           if (planType === 'training') {
             setTrainingMealPlan(newPlan);
             updateUserProfile('trainingMealPlan', newPlan);
           } else {
             setRestMealPlan(newPlan);
             updateUserProfile('restMealPlan', newPlan);
           }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalculatingMacrosForMeal(null);
    }
  };

  const [isGeneratingGoalPlan, setIsGeneratingGoalPlan] = useState<string | null>(null);

  const generateGoalSystemPlan = async (goalId: string) => {
    try {
      setIsGeneratingGoalPlan(goalId);
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are an expert performance coach and planner. I have a goal: "${goal.title}". My current progress is ${goal.current}${goal.unit} and my target is ${goal.target}${goal.unit}. The deadline is ${goal.deadline}. Generate a highly actionable "Optimal Flow System" for me to achieve this. Break it down into:
      1. **Daily Habits**: What I need to do every day.
      2. **Weekly Objectives**: What I should track/do weekly.
      3. **Timeline Strategy**: How to pace the progress towards the deadline.
      Keep it very concise, highly actionable, and formatted cleanly in Markdown (use bullet points, bold text).`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      if (response.text) {
        const newSystem = response.text.trim();
        const newGoals = goals.map(g => g.id === goalId ? { ...g, systemPlan: newSystem } : g);
        setGoals(newGoals);
        updateUserProfile('goals', newGoals);
      }
    } catch (e: any) {
      console.error(e);
      const errorMessage = e?.message?.includes("credits are depleted") || e?.message?.includes("429")
        ? "⚠️ **AI Quota Exceeded:** Your Gemini API prepayment credits for this project are depleted. Please check your Google AI Studio billing metrics to enable the system generation."
        : `⚠️ **Generation Error:** ${e?.message || "Could not generate strategy. Please try again."}`;
      
      const newGoals = goals.map(g => g.id === goalId ? { ...g, systemPlan: errorMessage } : g);
      setGoals(newGoals);
      // Not calling updateUserProfile here so the error state doesn't persist permanently to the DB
    } finally {
      setIsGeneratingGoalPlan(null);
    }
  };

  const getAdjustedMealPlan = () => {
    const plan = JSON.parse(JSON.stringify(baseMealPlan)) as MealPlan;
    
    // Define target indices for adjustments
    // Training: Lunch (1), Post-workout (5)
    // Rest: Lunch (1), Meal 5 (4)
    const targetIndices = isTrainingDay ? [1, 5] : [1, 4];
    
    const carbOffsetPerTarget = Math.round(macroOffsets.carbs / targetIndices.length);
    const fatOffsetPerTarget = Math.round(macroOffsets.fats / targetIndices.length);

    const updateFoodQuantity = (items: string[], macroType: 'carbs' | 'fats', offset: number) => {
      return items.map(item => {
        if (macroType === 'carbs' && item.toLowerCase().includes('jasmine rice')) {
          const match = item.match(/(\d+)g/);
          if (match) {
            const currentGrams = parseInt(match[1]);
            // 100g jasmine rice (cooked) is ~28g carbs. So 1g carbs = 3.57g rice
            const newGrams = Math.max(0, Math.round(currentGrams + (offset * 3.57)));
            return item.replace(`${currentGrams}g`, `${newGrams}g`);
          }
        }
        if (macroType === 'fats' && item.toLowerCase().includes('avocado')) {
          const match = item.match(/(\d+)g/);
          if (match) {
            const currentGrams = parseInt(match[1]);
            // 100g avocado is ~15g fat. So 1g fat = 6.67g avocado
            const newGrams = Math.max(0, Math.round(currentGrams + (offset * 6.67)));
            return item.replace(`${currentGrams}g`, `${newGrams}g`);
          }
        }
        if (macroType === 'fats' && item.toLowerCase().includes('peanut butter')) {
          const match = item.match(/(\d+)g/);
          if (match) {
            const currentGrams = parseInt(match[1]);
            // 10g PB is ~5g fat. So 1g fat = 2g PB
            const newGrams = Math.max(0, Math.round(currentGrams + (offset * 2)));
            return item.replace(`${currentGrams}g`, `${newGrams}g`);
          }
        }
        return item;
      });
    };

    return plan.map((meal, index) => {
      if (!targetIndices.includes(index)) return meal;

      const newCarbs = Math.max(0, meal.macros.carbs + carbOffsetPerTarget);
      const newFats = Math.max(0, meal.macros.fats + fatOffsetPerTarget);
      const carbDiff = newCarbs - meal.macros.carbs;
      const fatDiff = newFats - meal.macros.fats;
      const calorieDiff = (carbDiff * 4) + (fatDiff * 9);

      let newItems = [...meal.items];
      if (carbDiff !== 0) newItems = updateFoodQuantity(newItems, 'carbs', carbDiff);
      if (fatDiff !== 0) newItems = updateFoodQuantity(newItems, 'fats', fatDiff);

      return {
        ...meal,
        items: newItems,
        macros: {
          ...meal.macros,
          carbs: newCarbs,
          fats: newFats,
          calories: meal.macros.calories + calorieDiff
        }
      };
    });
  };

  const adjustedMealPlan = getAdjustedMealPlan();

  // Calculate current macros from adjusted plan
  const currentMacros = adjustedMealPlan.reduce((acc, meal) => ({
    calories: acc.calories + meal.macros.calories,
    protein: acc.protein + meal.macros.protein,
    carbs: acc.carbs + meal.macros.carbs,
    fats: acc.fats + meal.macros.fats
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  if (!isAuthReady) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-white px-6">
        <h1 className="font-serif text-[42px] mb-4">LifeOS</h1>
        <p className="text-[#8E8E8E] mb-8 text-center">Your daily performance tracker.</p>
        <button onClick={loginWithGoogle} className="flex items-center gap-2 bg-[#1C1C1C] border border-white/10 px-6 py-3 rounded-xl hover:border-[#C5A059] transition-colors">
          <LogIn className="w-5 h-5" />
          <span>Sign in with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans pb-24">
      {/* Header */}
      <header className="bg-[#080808] sticky top-0 z-10 pt-10 pb-6">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <div>
            <p className="text-[#8E8E8E] uppercase text-[12px] tracking-[2px] mb-2 flex items-center gap-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="text-[#C5A059]">{Object.values(completedBlocks).filter(Boolean).length}/{scheduleTemplate.length} Blocks</span>
            </p>
            <h1 className="font-serif text-[42px] font-light tracking-tight text-white leading-none">
              Optimal Flow
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowMenuDropdown(!showMenuDropdown)}
                className={cn("w-10 h-10 border rounded-xl flex flex-col items-center justify-center gap-1 transition-colors", showMenuDropdown ? "border-[#C5A059] text-[#C5A059] bg-[#C5A059]/10" : "border-white/10 text-[#8E8E8E] hover:border-[#C5A059] bg-[#121212]")}
                title="Menu"
              >
                <div className="w-4 h-0.5 bg-current rounded-full" />
                <div className="w-4 h-0.5 bg-current rounded-full" />
                <div className="w-4 h-0.5 bg-current rounded-full" />
              </button>
              
              {showMenuDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <button 
                    onClick={() => { setShowCalendarDropdown(true); setShowMenuDropdown(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 text-[#8E8E8E] hover:text-white transition-colors border-b border-white/5"
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span className="text-[13px]">Calendar</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab('history'); setShowMenuDropdown(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 text-[#8E8E8E] hover:text-white transition-colors border-b border-white/5"
                  >
                    <History className="w-4 h-4" />
                    <span className="text-[13px]">History & Progress</span>
                  </button>
                  <button 
                    onClick={() => { logout(); setShowMenuDropdown(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 text-red-500/80 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-[13px]">Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {showCalendarDropdown && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6" onClick={() => setShowCalendarDropdown(false)}>
                <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-serif text-2xl text-white">Calendar</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setShowEventModal(true)} className="p-2 bg-[#C5A059]/10 text-[#C5A059] rounded-xl"><Plus className="w-5 h-5" /></button>
                      <button onClick={() => setShowCalendarDropdown(false)} className="p-2 text-[#8E8E8E]"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {futureEvents.length > 0 ? futureEvents.map(event => (
                      <div key={event.id} className="bg-[#1C1C1C] p-4 rounded-2xl border border-white/5 relative group">
                        <button onClick={() => deleteFutureEvent(event.id)} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                        <div className="text-[10px] text-[#C5A059] uppercase tracking-[1px] mb-1 font-bold">{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-[15px] text-white font-medium mb-1">{event.title}</div>
                        <div className="text-[12px] text-[#8E8E8E] leading-relaxed">{event.description}</div>
                      </div>
                    )) : <div className="text-center py-12 text-[#8E8E8E] text-[14px]">No events planned</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-2">
        {activeTab === 'schedule' && (
          <div className="space-y-2 relative">
            {/* Vertical Timeline Line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-white/10 -z-10 hidden sm:block"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-[28px] text-white">Daily Flow</h2>
              <button onClick={() => setIsEditingSchedule(!isEditingSchedule)} className="text-[12px] text-[#C5A059] uppercase tracking-[1px]">
                {isEditingSchedule ? 'Done' : 'Edit Schedule'}
              </button>
            </div>

            {scheduleTemplate.map((item, index) => {
              const ActivityIcon = ACTIVITY_TYPES.find(a => a.type === item.type)?.icon || Timer;
              return (
                <div key={item.id} className="flex gap-4 sm:gap-6 relative group">
                  <div className="w-12 pt-5 text-[12px] text-[#8E8E8E] shrink-0 hidden sm:block text-right">
                    {isEditingSchedule ? (
                      <input type="time" value={item.time} onChange={(e) => updateScheduleItem(item.id, 'time', e.target.value)} className="bg-transparent text-right w-full focus:outline-none text-[#C5A059]" />
                    ) : item.time}
                  </div>
                  <div className="flex-1">
                    {isEditingSchedule ? (
                      <div className="bg-[#121212] border border-white/10 rounded-2xl p-4 mb-6 flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => moveScheduleItem(index, 'up')}><ArrowUp className="w-4 h-4 text-[#8E8E8E] hover:text-white" /></button>
                          <button onClick={() => moveScheduleItem(index, 'down')}><ArrowDown className="w-4 h-4 text-[#8E8E8E] hover:text-white" /></button>
                        </div>
                        <input type="text" value={item.title} onChange={(e) => updateScheduleItem(item.id, 'title', e.target.value)} className="flex-1 bg-transparent text-white font-serif text-[20px] focus:outline-none" />
                        <button onClick={() => removeScheduleItem(item.id)}><Trash2 className="w-5 h-5 text-red-500/70 hover:text-red-500" /></button>
                      </div>
                    ) : (
                      <>
                        {item.type === 'routine' && (
                          <ExpandableCard title={item.title} icon={ActivityIcon} status="Morning" completed={completedBlocks[item.id]} onToggleCompleted={() => toggleBlockCompletion(item.id)}>
                            <div className="flex items-center justify-between bg-[#1C1C1C] p-4 rounded-xl border border-white/5 mb-4">
                              <span className="text-[13px] text-[#8E8E8E] uppercase tracking-[1px]">Morning Weight</span>
                              <div className="flex items-center gap-2">
                                <input type="number" value={dailyWeight} onChange={(e) => { 
                                  const val = e.target.value === '' ? '' : Number(e.target.value);
                                  setDailyWeight(val); 
                                  updateDailyLog('weight', val, true); 
                                }} className="bg-[#080808] border border-white/10 rounded-lg px-3 py-1 w-20 text-right text-white focus:outline-none focus:border-[#C5A059]" placeholder="lbs" />
                                <span className="text-[12px] text-[#8E8E8E]">lbs</span>
                              </div>
                            </div>
                            <div className="bg-[#1C1C1C] p-4 rounded-xl border border-white/5 mb-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-col">
                                  <span className="text-[13px] text-[#8E8E8E] uppercase tracking-[1px]">Check-in Pictures</span>
                                  <span className="text-[10px] text-[#C5A059] uppercase tracking-[1px]">Bodybuilding Progress</span>
                                </div>
                                <label className="cursor-pointer flex items-center gap-2 text-[#C5A059] hover:text-white transition-colors">
                                  <Camera className="w-4 h-4" />
                                  <span className="text-[11px] uppercase tracking-[1px]">Upload Photos</span>
                                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {checkInPhotos.length > 0 ? checkInPhotos.map((photo, i) => (
                                  <div key={i} className="relative group aspect-square">
                                    <img src={photo} alt={`Check-in ${i}`} className="w-full h-full object-cover rounded-lg border border-white/10" />
                                    <button 
                                      onClick={() => removePhoto(i)}
                                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                )) : (
                                  <div className="col-span-2 w-full h-32 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-[#8E8E8E] gap-2">
                                    <Camera className="w-6 h-6 opacity-20" />
                                    <span className="text-[10px] uppercase tracking-[1px]">No Photos</span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-4">
                                <label className="text-[10px] text-[#8E8E8E] uppercase tracking-[1px] mb-2 block">Daily Notes</label>
                                <textarea 
                                  value={dailyNotes}
                                  onChange={(e) => {
                                    setDailyNotes(e.target.value);
                                    updateDailyLog('notes', e.target.value, true);
                                  }}
                                  placeholder="How are you feeling? Any specific notes for today?"
                                  className="w-full bg-[#080808] border border-white/10 rounded-xl p-3 text-[13px] text-white focus:outline-none focus:border-[#C5A059] min-h-[80px] resize-none"
                                />
                              </div>
                            </div>
                          </ExpandableCard>
                        )}
                        {(item.type === 'breakfast' || item.type === 'lunch' || item.type === 'dinner' || item.type === 'pre_workout' || item.type === 'post_workout') && (
                          <ExpandableCard title={item.title} icon={ActivityIcon} status="Nutrition" completed={completedBlocks[item.id]} onToggleCompleted={() => toggleBlockCompletion(item.id)}>
                            <div className="space-y-5">
                              {(() => {
                                const mealIndex = 
                                  item.type === 'breakfast' ? 0 : 
                                  item.type === 'lunch' ? 1 : 
                                  item.type === 'dinner' ? 2 : 
                                  item.type === 'pre_workout' ? 3 : 
                                  item.type === 'post_workout' ? (isTrainingDay ? 5 : 4) : -1;
                                
                                const meal = adjustedMealPlan[mealIndex];
                                if (!meal) return null;
                                return (
                                  <>
                                    <div className="grid grid-cols-4 gap-3 mb-4">
                                      {[{ label: 'Kcal', val: meal.macros.calories }, { label: 'Prot', val: meal.macros.protein }, { label: 'Carb', val: meal.macros.carbs }, { label: 'Fat', val: meal.macros.fats }].map((m, i) => (
                                        <div key={i} className="bg-[#1C1C1C] rounded-xl p-3 text-center border border-white/5">
                                          <span className="block text-lg font-semibold text-white">{m.val}</span>
                                          <span className="text-[10px] text-[#8E8E8E] uppercase block mt-1">{m.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="space-y-2">
                                      {meal.items.map((food, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-[#1C1C1C] p-3 rounded-xl border border-white/5">
                                          <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />
                                          <span className="text-[13px] text-white">{food}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                );
                              })()}
                              <ProgressBar current={currentMacros.calories} target={targetMacros.calories} label="Total Daily Progress" unit="kcal" />
                              <button onClick={() => setActiveTab('food')} className="w-full py-3 bg-[#1C1C1C] text-[#C5A059] rounded-xl text-[12px] uppercase tracking-[1px] hover:bg-white/5 transition-colors border border-white/5">Adjust Meal Plan</button>
                            </div>
                          </ExpandableCard>
                        )}
                        {item.type === 'training' && (
                          <ExpandableCard title={`${item.title}: ${currentWorkout.day}`} icon={ActivityIcon} status="Workout" completed={completedBlocks[item.id]} onToggleCompleted={() => toggleBlockCompletion(item.id)}>
                            <div className="space-y-4">
                              <div className="flex bg-[#080808] rounded-lg p-1 mb-4 border border-white/5">
                                <button onClick={() => updateUserProfile('trainingBlock', 'strength')} className={cn("flex-1 text-center text-[11px] py-2 rounded-md transition-colors uppercase tracking-[1px]", trainingBlock === 'strength' ? "bg-[#1C1C1C] text-[#C5A059]" : "text-[#8E8E8E] hover:text-white")}>Strength Block (+5 lbs)</button>
                                <button onClick={() => updateUserProfile('trainingBlock', 'growth')} className={cn("flex-1 text-center text-[11px] py-2 rounded-md transition-colors uppercase tracking-[1px]", trainingBlock === 'growth' ? "bg-[#1C1C1C] text-[#C5A059]" : "text-[#8E8E8E] hover:text-white")}>Growth Block (+2-3 reps)</button>
                              </div>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[12px] text-[#8E8E8E]">Day {currentSplitIndex + 1} of 7</span>
                                <div className="flex gap-4">
                                  <button 
                                    onClick={() => {
                                      if (isEditingWorkoutSplit) {
                                        updateUserProfile('workoutSplit', workoutSplit);
                                      }
                                      setIsEditingWorkoutSplit(!isEditingWorkoutSplit);
                                    }}
                                    className="text-[11px] text-[#C5A059] uppercase tracking-[1px] flex items-center gap-1"
                                  >
                                    {isEditingWorkoutSplit ? <><CheckCircle2 className="w-3 h-3" /> Save</> : <><Edit2 className="w-3 h-3" /> Edit Split</>}
                                  </button>
                                  <div className="flex gap-2">
                                    <button onClick={() => updateUserProfile('currentSplitIndex', Math.max(0, currentSplitIndex - 1))} className="text-[11px] text-[#8E8E8E] hover:text-white">&lt; Prev</button>
                                    <button onClick={() => updateUserProfile('currentSplitIndex', currentSplitIndex + 1)} className="text-[11px] text-[#8E8E8E] hover:text-white">Next &gt;</button>
                                  </div>
                                </div>
                              </div>
                              {(currentWorkout.exercises.length > 0 || isEditingWorkoutSplit) ? (
                                <>
                                  <div className="grid grid-cols-12 text-[10px] uppercase tracking-[1px] text-[#8E8E8E] px-2 mb-2 gap-2">
                                    <div className="col-span-4">Exercise</div>
                                    <div className="col-span-3 text-center">Target</div>
                                    <div className="col-span-5 text-center">{isEditingWorkoutSplit ? 'Sets' : 'Log (Lbs x Reps)'}</div>
                                  </div>
                                  {currentWorkout.exercises.map((ex, idx) => {
                                    const logged = loggedExercises[ex.name] || { weight: '', reps: '' };
                                    return (
                                      <div key={idx} className="grid grid-cols-12 items-center bg-[#1C1C1C] p-3 rounded-xl border border-white/5 mb-2 gap-2">
                                        <div className="col-span-4">
                                          {isEditingWorkoutSplit ? (
                                            <input 
                                              type="text" 
                                              value={ex.name} 
                                              onChange={(e) => {
                                                const newSplit = [...workoutSplit];
                                                newSplit[currentSplitIndex % workoutSplit.length].exercises[idx].name = e.target.value;
                                                setWorkoutSplit(newSplit);
                                              }}
                                              className="w-full bg-transparent border-b border-white/10 text-[12px] text-white focus:outline-none focus:border-[#C5A059]"
                                            />
                                          ) : (
                                            <>
                                              <div className="font-medium text-[12px] text-white leading-tight">{ex.name}</div>
                                              <div className="text-[10px] text-[#8E8E8E] mt-1">Sets: {ex.sets}</div>
                                            </>
                                          )}
                                        </div>
                                        <div className="col-span-3 text-center">
                                          {isEditingWorkoutSplit ? (
                                            <input 
                                              type="text" 
                                              value={ex.reps} 
                                              onChange={(e) => {
                                                const newSplit = [...workoutSplit];
                                                newSplit[currentSplitIndex % workoutSplit.length].exercises[idx].reps = e.target.value;
                                                setWorkoutSplit(newSplit);
                                              }}
                                              className="w-full bg-transparent border-b border-white/10 text-center text-[11px] text-[#C5A059] focus:outline-none"
                                            />
                                          ) : (
                                            <span className="text-[11px] font-semibold text-[#C5A059]">{ex.reps}</span>
                                          )}
                                        </div>
                                        <div className="col-span-5 flex items-center justify-end gap-1">
                                          {isEditingWorkoutSplit ? (
                                            <div className="flex items-center gap-2">
                                              <input 
                                                type="number" 
                                                value={ex.sets} 
                                                onChange={(e) => {
                                                  const newSplit = [...workoutSplit];
                                                  newSplit[currentSplitIndex % workoutSplit.length].exercises[idx].sets = Number(e.target.value);
                                                  setWorkoutSplit(newSplit);
                                                }}
                                                className="w-10 bg-[#080808] border border-white/10 rounded px-1 py-1 text-center text-[12px] text-white"
                                              />
                                              <button onClick={() => {
                                                const newSplit = [...workoutSplit];
                                                newSplit[currentSplitIndex % workoutSplit.length].exercises.splice(idx, 1);
                                                setWorkoutSplit(newSplit);
                                              }} className="text-red-500/50 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                          ) : (
                                            <>
                                              <input type="number" placeholder="lbs" value={logged.weight} onChange={(e) => { const newLogged = { ...loggedExercises, [ex.name]: { ...logged, weight: e.target.value } }; setLoggedExercises(newLogged); updateWorkoutLog(newLogged, true); }} className="w-12 bg-[#080808] border border-white/10 rounded px-1 py-1 text-center text-[12px] text-white focus:outline-none focus:border-[#C5A059]" />
                                              <span className="text-[#8E8E8E] text-[10px]">x</span>
                                              <input type="number" placeholder="reps" value={logged.reps} onChange={(e) => { const newLogged = { ...loggedExercises, [ex.name]: { ...logged, reps: e.target.value } }; setLoggedExercises(newLogged); updateWorkoutLog(newLogged, true); }} className="w-12 bg-[#080808] border border-white/10 rounded px-1 py-1 text-center text-[12px] text-white focus:outline-none focus:border-[#C5A059]" />
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {isEditingWorkoutSplit && (
                                    <button 
                                      onClick={() => {
                                        const newSplit = [...workoutSplit];
                                        newSplit[currentSplitIndex % workoutSplit.length].exercises.push({ name: 'New Exercise', sets: 3, reps: '10-12' });
                                        setWorkoutSplit(newSplit);
                                      }}
                                      className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[11px] text-[#8E8E8E] hover:text-[#C5A059] transition-colors flex items-center justify-center gap-2 mt-2"
                                    >
                                      <Plus className="w-3 h-3" /> Add Exercise
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="text-center py-8 text-[#8E8E8E] text-[13px]"><p>Rest Day. Recover well.</p></div>
                              )}
                            </div>
                          </ExpandableCard>
                        )}
                        {(item.type === 'work' || item.type === 'admin' || item.type === 'side_hustle' || item.type === 'custom' || item.type === 'running' || item.type === 'swimming' || item.type === 'studying' || item.type === 'meditating') && (
                          <ExpandableCard title={item.title} icon={ActivityIcon} status="Focus" completed={completedBlocks[item.id]} onToggleCompleted={() => toggleBlockCompletion(item.id)}>
                            <div className="space-y-4">
                              {/* Daily KPIs Section */}
                              <div className="space-y-2">
                                <div className="text-[10px] text-[#C5A059] uppercase tracking-[1px] font-bold">Daily KPIs</div>
                                {(dailyKpis[item.id] || []).map(kpi => {
                                  const target = Number(kpi.target) || 1;
                                  const pct = Math.min(100, Math.round((Number(kpi.value) / target) * 100)) || 0;
                                  return (
                                  <div key={kpi.id} className="flex flex-col bg-[#1C1C1C] p-3 rounded-xl border border-white/5 relative group">
                                    <button onClick={() => removeKpi(item.id, kpi.id)} className="absolute -left-2 -top-2 opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-500 rounded-full p-1 transition-opacity z-10">
                                      <X className="w-3 h-3" />
                                    </button>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[13px] text-white flex-1 font-medium">{kpi.name}</span>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={kpi.value}
                                          onChange={(e) => updateKpi(item.id, kpi.id, 'value', e.target.value)}
                                          className="w-14 bg-[#080808] border border-white/10 rounded px-1 py-1 text-center text-[12px] text-[#C5A059] font-bold focus:outline-none focus:border-[#C5A059]"
                                          placeholder="0"
                                        />
                                        <span className="text-[10px] text-[#8E8E8E]">/</span>
                                        <input
                                          type="number"
                                          value={kpi.target}
                                          onChange={(e) => updateKpi(item.id, kpi.id, 'target', e.target.value)}
                                          className="w-14 bg-[#080808] border border-white/10 rounded px-1 py-1 text-center text-[12px] text-[#8E8E8E] focus:outline-none focus:border-[#C5A059]"
                                          placeholder="100"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#C5A059]" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[10px] text-[#8E8E8E] w-8 text-right font-mono">{pct}%</span>
                                    </div>
                                  </div>
                                )})}
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="+ Add a KPI (e.g. Sales Calls, Pages Read)..." 
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addKpi(item.id, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    className="flex-1 bg-transparent border border-dashed border-white/10 rounded-lg px-3 py-2 text-[12px] text-[#8E8E8E] focus:outline-none focus:border-white/30 focus:text-white"
                                  />
                                </div>
                              </div>

                              {/* Work Tracking / Tasks Section */}
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <div className="text-[10px] text-[#C5A059] uppercase tracking-[1px] font-bold">Tasks</div>
                                {(tasks[item.id] || []).map(task => (
                                  <div key={task.id} className="flex items-center gap-3 bg-[#1C1C1C] p-3 rounded-xl border border-white/5 relative group">
                                    <button onClick={() => removeTask(item.id, task.id)} className="absolute -left-2 -top-2 opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-500 rounded-full p-1 transition-opacity z-10">
                                      <X className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => toggleTask(item.id, task.id)} className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0", task.completed ? "bg-[#C5A059] border-[#C5A059]" : "border-white/20")}>
                                      {task.completed && <CheckSquare className="w-3 h-3 text-black" />}
                                    </button>
                                    <span className={cn("text-[13px] flex-1", task.completed ? "text-[#8E8E8E] line-through" : "text-white")}>{task.title}</span>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                  <input 
                                    type="text" 
                                    placeholder="+ Add a task..." 
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addTask(item.id, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    className="flex-1 bg-transparent border border-dashed border-white/10 rounded-lg px-3 py-2 text-[12px] text-[#8E8E8E] focus:outline-none focus:border-white/30 focus:text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          </ExpandableCard>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            
            {isEditingSchedule && (
              <div className="relative">
                <button 
                  onClick={() => setShowActivityPicker(!showActivityPicker)} 
                  className="w-full py-4 border border-dashed border-white/20 rounded-2xl text-[#8E8E8E] hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Activity
                </button>
                
                {showActivityPicker && (
                  <div className="absolute bottom-full left-0 right-0 mb-4 bg-[#121212] border border-white/10 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 z-30 shadow-2xl">
                    {ACTIVITY_TYPES.map(a => (
                      <button 
                        key={a.type} 
                        onClick={() => addScheduleItem(a.type)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <a.icon className="w-4 h-4 text-[#C5A059]" />
                        <span className="text-[12px] text-white">{a.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'food' && (
          <div className="py-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-[28px] text-white">Meal Plan & Calculator</h2>
              <div className="flex gap-2">
                {(['cut', 'maintain', 'bulk'] as const).map(goal => (
                  <button 
                    key={goal}
                    onClick={() => { setCurrentGoal(goal); updateUserProfile('currentGoal', goal); }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[10px] uppercase tracking-[1px] border transition-all",
                      currentGoal === goal ? "bg-[#C5A059] border-[#C5A059] text-black font-bold" : "border-white/10 text-[#8E8E8E] hover:border-white/30"
                    )}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            {/* Macro Calculator */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-[#C5A059]" />
                <h3 className="text-[16px] font-serif text-white">Macro Adjustment Calculator</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[12px] text-[#8E8E8E] uppercase tracking-[1px]">Daily Carb Offset</label>
                    <span className={cn("text-[14px] font-bold", macroOffsets.carbs > 0 ? "text-green-500" : macroOffsets.carbs < 0 ? "text-red-500" : "text-white")}>
                      {macroOffsets.carbs > 0 ? '+' : ''}{macroOffsets.carbs}g
                    </span>
                  </div>
                  <input 
                    type="range" min="-200" max="200" step="5"
                    value={macroOffsets.carbs}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMacroOffsets(prev => ({ ...prev, carbs: val }));
                      updateUserProfile('macroOffsets', { ...macroOffsets, carbs: val }, true);
                    }}
                    className="w-full h-1.5 bg-[#1C1C1C] rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8E8E8E]">
                    <span>-200g</span>
                    <span>0g</span>
                    <span>+200g</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[12px] text-[#8E8E8E] uppercase tracking-[1px]">Daily Fat Offset</label>
                    <span className={cn("text-[14px] font-bold", macroOffsets.fats > 0 ? "text-green-500" : macroOffsets.fats < 0 ? "text-red-500" : "text-white")}>
                      {macroOffsets.fats > 0 ? '+' : ''}{macroOffsets.fats}g
                    </span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" step="2"
                    value={macroOffsets.fats}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMacroOffsets(prev => ({ ...prev, fats: val }));
                      updateUserProfile('macroOffsets', { ...macroOffsets, fats: val }, true);
                    }}
                    className="w-full h-1.5 bg-[#1C1C1C] rounded-lg appearance-none cursor-pointer accent-[#C5A059]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8E8E8E]">
                    <span>-50g</span>
                    <span>0g</span>
                    <span>+50g</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Kcal', val: currentMacros.calories },
                  { label: 'Total Prot', val: currentMacros.protein },
                  { label: 'Total Carb', val: currentMacros.carbs },
                  { label: 'Total Fat', val: currentMacros.fats }
                ].map((m, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[18px] font-bold text-white">{m.val}</div>
                    <div className="text-[10px] text-[#8E8E8E] uppercase">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal Plan Preview */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[22px] text-white">
                  {isTrainingDay ? 'Training Day Plan' : 'Rest Day Plan'}
                </h3>
                <button 
                  onClick={() => {
                    if (isEditingMealPlan) {
                      updateUserProfile(isTrainingDay ? 'trainingMealPlan' : 'restMealPlan', isTrainingDay ? trainingMealPlan : restMealPlan);
                    }
                    setIsEditingMealPlan(!isEditingMealPlan);
                  }}
                  className="text-[12px] text-[#C5A059] uppercase tracking-[1px] flex items-center gap-1"
                >
                  {isEditingMealPlan ? <><CheckCircle2 className="w-4 h-4" /> Save Plan</> : <><Edit2 className="w-4 h-4" /> Edit Plan</>}
                </button>
              </div>

              {(isTrainingDay ? trainingMealPlan : restMealPlan).map((meal, idx) => (
                <div key={idx} className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                    {isEditingMealPlan ? (
                      <div className="flex flex-col gap-2 flex-1">
                        <input 
                          type="text" 
                          value={meal.title} 
                          onChange={(e) => {
                            const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                            newPlan[idx].title = e.target.value;
                            isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                          }}
                          className="bg-transparent border-b border-white/20 text-white font-serif text-[18px] focus:outline-none focus:border-[#C5A059]"
                        />
                        <div className="flex gap-2">
                          <input type="number" value={meal.macros.protein} onChange={e => {
                            const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                            newPlan[idx].macros.protein = Number(e.target.value);
                            isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                          }} className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-[10px]" placeholder="P" />
                          <input type="number" value={meal.macros.carbs} onChange={e => {
                            const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                            newPlan[idx].macros.carbs = Number(e.target.value);
                            isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                          }} className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-[10px]" placeholder="C" />
                          <input type="number" value={meal.macros.fats} onChange={e => {
                            const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                            newPlan[idx].macros.fats = Number(e.target.value);
                            isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                          }} className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-[10px]" placeholder="F" />
                          <input type="number" value={meal.macros.calories} onChange={e => {
                            const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                            newPlan[idx].macros.calories = Number(e.target.value);
                            isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                          }} className="w-14 bg-black/40 border border-white/10 rounded px-1 text-center text-[10px]" placeholder="Kcal" />
                          <button 
                            disabled={isCalculatingMacrosForMeal?.plan === (isTrainingDay ? 'training' : 'rest') && isCalculatingMacrosForMeal?.idx === idx}
                            onClick={() => calculateMealMacrosWithAI(isTrainingDay ? 'training' : 'rest', idx)}
                            className="bg-[#C5A059]/10 text-[#C5A059] px-2 rounded hover:bg-[#C5A059]/20 transition-colors flex items-center gap-1 text-[10px] disabled:opacity-50"
                          >
                            {isCalculatingMacrosForMeal?.plan === (isTrainingDay ? 'training' : 'rest') && isCalculatingMacrosForMeal?.idx === idx 
                              ? <Loader2 className="w-3 h-3 animate-spin"/> 
                              : <Sparkles className="w-3 h-3" />}
                            AI Calc
                          </button>
                        </div>
                      </div>
                    ) : (
                      <h4 className="font-serif text-[18px] text-white">{meal.title}</h4>
                    )}
                    <div className="flex gap-3 text-[11px] text-[#8E8E8E]">
                      {!isEditingMealPlan && (
                        <>
                          <span>{meal.macros.protein}P</span>
                          <span>{meal.macros.carbs}C</span>
                          <span>{meal.macros.fats}F</span>
                          <span className="text-[#C5A059] font-bold">{meal.macros.calories} kcal</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {meal.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-[13px] text-[#8E8E8E]">
                        <div className="w-1 h-1 rounded-full bg-[#C5A059]" />
                        {isEditingMealPlan ? (
                          <div className="flex-1 flex gap-2">
                            <input 
                              type="text" 
                              value={item} 
                              onChange={(e) => {
                                const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                                newPlan[idx].items[i] = e.target.value;
                                isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                              }}
                              className="flex-1 bg-transparent border-b border-white/10 text-white focus:outline-none focus:border-[#C5A059]"
                            />
                            <button onClick={() => {
                              const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                              newPlan[idx].items.splice(i, 1);
                              isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                            }} className="text-red-500/50 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          item
                        )}
                      </div>
                    ))}
                    {isEditingMealPlan && (
                      <button 
                        onClick={() => {
                          const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan)];
                          newPlan[idx].items.push('New Item');
                          isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                        }}
                        className="text-[11px] text-[#C5A059] mt-2 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Item
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isEditingMealPlan && (
                <button 
                  onClick={() => {
                    const newMeal: Meal = { title: 'New Meal', items: ['New Item'], macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
                    const newPlan = [...(isTrainingDay ? trainingMealPlan : restMealPlan), newMeal];
                    isTrainingDay ? setTrainingMealPlan(newPlan) : setRestMealPlan(newPlan);
                  }}
                  className="w-full py-4 border border-dashed border-white/20 rounded-2xl text-[#C5A059] hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Meal to Plan
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="py-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-serif text-[28px] text-white">Strategic Goals</h2>
              <button onClick={() => {
                const newGoal: Goal = { id: Date.now().toString(), title: 'New Goal', current: 0, target: 100, unit: '%', startDate: new Date().toISOString().split('T')[0], deadline: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] };
                const newGoals = [...goals, newGoal];
                setGoals(newGoals);
                updateUserProfile('goals', newGoals);
                setEditingGoalId(newGoal.id);
              }} className="text-[12px] text-[#C5A059] uppercase tracking-[1px] flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Goal
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Bodybuilding Goal Weight Tracker */}
              <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 mb-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-white font-serif text-[20px] mb-1">Bodybuilding Goal Track</h3>
                    <p className="text-[12px] text-[#8E8E8E]">Track your weight progress and projected outcomes.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-[#1C1C1C] rounded-xl px-4 py-2 border border-white/5">
                      <div className="text-[10px] text-[#8E8E8E] uppercase tracking-[1px] mb-1">Target Weight</div>
                      <input 
                        type="number" 
                        value={targetWeight}
                        onChange={e => {
                          setTargetWeight(Number(e.target.value));
                          updateUserProfile('targetWeight', Number(e.target.value), true);
                        }}
                        className="bg-transparent text-white font-serif text-[18px] w-16 focus:outline-none"
                      /> <span className="text-[#8E8E8E] text-[12px]">lbs</span>
                    </div>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {checkInHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...checkInHistory].reverse().map(h => ({ date: new Date(h.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }), weight: h.weight }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#8E8E8E" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          domain={['dataMin - 5', 'dataMax + 5']} 
                          stroke="#8E8E8E" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          dx={-10}
                          tickFormatter={(val) => `${val}lbs`}
                        />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#121212', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#C5A059' }}
                        />
                        <ReferenceLine y={targetWeight} stroke="#C5A059" strokeDasharray="3 3" label={{ position: 'right', value: 'Target', fill: '#C5A059', fontSize: 10 }} />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#fff" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: '#121212', stroke: '#fff', strokeWidth: 2 }} 
                          activeDot={{ r: 6, fill: '#C5A059', stroke: '#121212' }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[#8E8E8E] text-[13px]">
                      Log your daily weight in the Schedule to see progress.
                    </div>
                  )}
                </div>
              </div>

              {goals.map(goal => {
                const progress = calculateGoalProgress(goal);
                if (editingGoalId === goal.id) {
                  return (
                    <div key={goal.id} className="bg-[#121212] border border-[#C5A059] rounded-2xl p-5">
                      <input type="text" value={goal.title} onChange={e => {
                        const newGoals = goals.map(g => g.id === goal.id ? { ...g, title: e.target.value } : g);
                        setGoals(newGoals);
                      }} className="w-full bg-transparent text-white font-serif text-[22px] mb-4 focus:outline-none" placeholder="Goal Title" />
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div><label className="text-[10px] text-[#8E8E8E] uppercase">Current</label><input type="number" value={goal.current} onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, current: Number(e.target.value) } : g))} className="w-full bg-[#080808] border border-white/10 rounded-lg px-3 py-2 text-white" /></div>
                        <div><label className="text-[10px] text-[#8E8E8E] uppercase">Target</label><input type="number" value={goal.target} onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, target: Number(e.target.value) } : g))} className="w-full bg-[#080808] border border-white/10 rounded-lg px-3 py-2 text-white" /></div>
                        <div><label className="text-[10px] text-[#8E8E8E] uppercase">Unit</label><input type="text" value={goal.unit} onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, unit: e.target.value } : g))} className="w-full bg-[#080808] border border-white/10 rounded-lg px-3 py-2 text-white" /></div>
                        <div><label className="text-[10px] text-[#8E8E8E] uppercase">Deadline</label><input type="date" value={goal.deadline} onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, deadline: e.target.value } : g))} className="w-full bg-[#080808] border border-white/10 rounded-lg px-3 py-2 text-white" /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingGoalId(null); updateUserProfile('goals', goals); }} className="flex-1 bg-[#C5A059] text-black py-2 rounded-lg text-[12px] uppercase tracking-[1px] font-semibold">Save</button>
                        <button onClick={() => {
                          const newGoals = goals.filter(g => g.id !== goal.id);
                          setGoals(newGoals);
                          updateUserProfile('goals', newGoals);
                          setEditingGoalId(null);
                        }} className="flex-1 bg-red-500/10 text-red-500 py-2 rounded-lg text-[12px] uppercase tracking-[1px]">Delete</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={goal.id} className="relative group">
                    <button onClick={() => setEditingGoalId(goal.id)} className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-[#8E8E8E] hover:text-white">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <div className="flex justify-between text-[12px] mb-2 text-[#8E8E8E]">
                      <span className="text-white font-medium">{goal.title}</span>
                      <div className="flex items-center gap-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", progress.ahead ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                          {progress.difference}% {progress.ahead ? 'Ahead' : 'Behind'}
                        </span>
                        <span>{goal.current} / {goal.target} {goal.unit} ({progress.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#1C1C1C] rounded-full h-1.5 mb-4">
                      <div className="bg-[#C5A059] h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    {goal.systemPlan ? (
                      <div className="bg-[#1C1C1C] rounded-2xl p-5 border border-white/5 mt-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-[#C5A059] text-[11px] uppercase tracking-[1px] font-semibold flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> AI Optimal Flow Strategy
                          </h4>
                          <button 
                            onClick={() => generateGoalSystemPlan(goal.id)}
                            disabled={isGeneratingGoalPlan === goal.id}
                            className="text-[10px] text-[#8E8E8E] hover:text-white transition-colors"
                          >
                            {isGeneratingGoalPlan === goal.id ? 'Regenerating...' : 'Regenerate'}
                          </button>
                        </div>
                        <div className="markdown-body text-[#D4D4D4] text-[13px] leading-relaxed">
                          <Markdown>{goal.systemPlan}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => generateGoalSystemPlan(goal.id)}
                        disabled={isGeneratingGoalPlan === goal.id}
                        className="w-full mt-4 py-3 bg-[#1C1C1C] border border-white/5 rounded-xl text-[#C5A059] text-[11px] uppercase tracking-[1px] hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingGoalPlan === goal.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Drafting Optimal Flow...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Draft Optimal Flow System</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <div className="py-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-serif text-[28px] text-white">History & Progress</h2>
              <button onClick={() => setActiveTab('schedule')} className="text-[12px] text-[#8E8E8E] hover:text-white flex items-center gap-1">
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            <div className="space-y-8">
              {checkInHistory.length > 0 ? checkInHistory.map((h, i) => {
                const prevWeight = checkInHistory[i + 1]?.weight;
                const weightDiff = prevWeight ? h.weight - prevWeight : 0;
                
                return (
                  <div key={h.date} className="bg-[#121212] border border-white/10 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-[#C5A059] uppercase tracking-[2px] font-bold mb-1">
                          {new Date(h.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-serif text-white">{h.weight} lbs</span>
                          {weightDiff !== 0 && (
                            <div className={cn("flex items-center gap-1 text-[12px] font-bold", weightDiff > 0 ? "text-red-500" : "text-green-500")}>
                              {weightDiff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                              {Math.abs(weightDiff).toFixed(1)} lbs
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {h.photos && h.photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {h.photos.map((photo, pi) => (
                            <img key={pi} src={photo} alt="Progress" className="w-full aspect-square object-cover rounded-2xl border border-white/5" />
                          ))}
                        </div>
                      )}
                      
                      {h.notes && (
                        <div className="bg-white/5 rounded-2xl p-4">
                          <div className="text-[10px] text-[#8E8E8E] uppercase tracking-[1px] mb-2">Daily Notes</div>
                          <p className="text-[14px] text-white/80 leading-relaxed italic">"{h.notes}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-20 text-[#8E8E8E]">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No history entries found yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AIChatWidget contextData={{
        goals,
        targetMacros,
        macroOffsets,
        trainingBlock,
        workoutSplit,
        scheduleTemplate,
        dailyKpis,
        tasks
      }} />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-[#121212] border-t border-white/10 pb-safe z-20">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-around">
          <button onClick={() => setActiveTab('schedule')} className={cn("flex flex-col items-center gap-2 transition-colors", activeTab === 'schedule' ? "text-[#C5A059]" : "text-[#8E8E8E] hover:text-white")}>
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-[1px]">Schedule</span>
          </button>
          <button onClick={() => setActiveTab('food')} className={cn("flex flex-col items-center gap-2 transition-colors", activeTab === 'food' ? "text-[#C5A059]" : "text-[#8E8E8E] hover:text-white")}>
            <Utensils className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-[1px]">Meal Plan</span>
          </button>
          <button onClick={() => setActiveTab('goals')} className={cn("flex flex-col items-center gap-2 transition-colors", activeTab === 'goals' ? "text-[#C5A059]" : "text-[#8E8E8E] hover:text-white")}>
            <Target className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-[1px]">Goals</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
