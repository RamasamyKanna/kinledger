import {
  BookOpen,
  Car,
  Clapperboard,
  HeartPulse,
  Home,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Zap,
} from 'lucide-react';

interface CategoryIconProps {
  category: string;
  size?: number;
}

export function CategoryIcon({ category, size = 18 }: CategoryIconProps) {
  switch (category) {
    case 'Groceries':
      return <ShoppingCart size={size} strokeWidth={2} />;
    case 'Housing':
      return <Home size={size} strokeWidth={2} />;
    case 'Utilities':
      return <Zap size={size} strokeWidth={2} />;
    case 'Dining Out':
      return <Utensils size={size} strokeWidth={2} />;
    case 'Transport':
      return <Car size={size} strokeWidth={2} />;
    case 'Subscriptions':
      return <Repeat size={size} strokeWidth={2} />;
    case 'Healthcare':
      return <HeartPulse size={size} strokeWidth={2} />;
    case 'Shopping':
      return <ShoppingBag size={size} strokeWidth={2} />;
    case 'Entertainment':
      return <Clapperboard size={size} strokeWidth={2} />;
    case 'Education':
      return <BookOpen size={size} strokeWidth={2} />;
    default:
      return <ShoppingBag size={size} strokeWidth={2} />;
  }
}

export function getCategoryTint(category: string): string {
  switch (category) {
    case 'Groceries':
      return 'bg-emerald-50 text-emerald-700';
    case 'Housing':
      return 'bg-slate-100 text-slate-700';
    case 'Utilities':
      return 'bg-amber-50 text-amber-700';
    case 'Dining Out':
      return 'bg-orange-50 text-orange-700';
    case 'Transport':
      return 'bg-sky-50 text-sky-700';
    case 'Subscriptions':
      return 'bg-indigo-50 text-indigo-700';
    case 'Healthcare':
      return 'bg-rose-50 text-rose-700';
    case 'Shopping':
      return 'bg-fuchsia-50 text-fuchsia-700';
    case 'Entertainment':
      return 'bg-violet-50 text-violet-700';
    case 'Education':
      return 'bg-teal-50 text-teal-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
