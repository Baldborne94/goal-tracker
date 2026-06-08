export type MealTime = "colazione" | "spuntino" | "pranzo" | "merenda";

export type FoodItem = { name: string; quantity: string };

export type Meal = {
  time: MealTime;
  label: string;
  foods: FoodItem[];
};

export type DayPlan = {
  day: string;
  label: string;
  meals: Meal[];
};

export const MEAL_ORDER: MealTime[] = ["colazione", "spuntino", "pranzo", "merenda"];

export const MEAL_LABELS: Record<MealTime, string> = {
  colazione: "Colazione",
  spuntino: "Spuntino",
  pranzo: "Pranzo",
  merenda: "Merenda",
};

export const MEAL_REMINDERS: Record<MealTime, string> = {
  colazione: "08:30",
  spuntino: "10:30",
  pranzo: "13:00",
  merenda: "16:30",
};

export const MEAL_ICONS: Record<MealTime, string> = {
  colazione: "☀️",
  spuntino: "🍎",
  pranzo: "🍽️",
  merenda: "🌤️",
};

export const WEEKLY_PLAN: DayPlan[] = [
  {
    day: "lunedi",
    label: "Lunedì",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Yogurt greco 0%", quantity: "170g" },
          { name: "Pane integrale tostato", quantity: "40g" },
          { name: "Crema nocciole e cacao", quantity: "25g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Mandorle", quantity: "10g" },
          { name: "Barretta proteica", quantity: "25g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Pasta integrale", quantity: "70g" },
          { name: "Fagioli sc.", quantity: "200g" },
          { name: "Tonno", quantity: "100g" },
          { name: "Rucola", quantity: "100g" },
          { name: "Olive nere", quantity: "10g" },
          { name: "Pomodori", quantity: "150g" },
          { name: "Olio", quantity: "10g" },
          { name: "Aceto balsamico", quantity: "5g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Albicocche", quantity: "100g" },
          { name: "Mandorle", quantity: "5g" },
          { name: "Parmigiano", quantity: "20g" },
        ],
      },
    ],
  },
  {
    day: "martedi",
    label: "Martedì",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Avocado", quantity: "50g" },
          { name: "Spremuta", quantity: "200ml" },
          { name: "Uovo", quantity: "50g" },
          { name: "Pane", quantity: "50g" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Mandorle", quantity: "20g" },
          { name: "Cioccolato 85%", quantity: "10g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Riso basmati", quantity: "60g" },
          { name: "Asiago", quantity: "30g" },
          { name: "Salmone affumicato", quantity: "50g" },
          { name: "Lattuga", quantity: "80g" },
          { name: "Finocchi", quantity: "200g" },
          { name: "Olio", quantity: "5g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Pesca", quantity: "150g" },
          { name: "Tacchino", quantity: "50g" },
          { name: "Pane", quantity: "30g" },
        ],
      },
    ],
  },
  {
    day: "mercoledi",
    label: "Mercoledì",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Fragole", quantity: "120g" },
          { name: "Latte", quantity: "150ml" },
          { name: "Marmellata", quantity: "15g" },
          { name: "Pane", quantity: "30g" },
          { name: "Burro", quantity: "15g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Mandorle", quantity: "10g" },
          { name: "Barretta proteica", quantity: "25g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Pasta lenticchie", quantity: "70g" },
          { name: "Tonno", quantity: "100g" },
          { name: "Pomodori", quantity: "200g" },
          { name: "Cipolla", quantity: "50g" },
          { name: "Carote", quantity: "200g" },
          { name: "Olio", quantity: "5g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Albicocche", quantity: "200g" },
          { name: "Noci", quantity: "10g" },
          { name: "Yogurt", quantity: "170g" },
        ],
      },
    ],
  },
  {
    day: "giovedi",
    label: "Giovedì",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Lamponi", quantity: "150g" },
          { name: "Nocciole", quantity: "15g" },
          { name: "Yogurt bianco", quantity: "150g" },
          { name: "Biscotti", quantity: "40g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Ciliegie", quantity: "120g" },
          { name: "Uovo sodo", quantity: "50g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Salmone", quantity: "100g" },
          { name: "Pane", quantity: "70g" },
          { name: "Lattuga", quantity: "100g" },
          { name: "Zucchine", quantity: "200g" },
          { name: "Cipolla", quantity: "10g" },
          { name: "Olio", quantity: "10g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Hamburger pollo", quantity: "100g" },
          { name: "Pane", quantity: "40g" },
          { name: "Olio", quantity: "5g" },
        ],
      },
    ],
  },
  {
    day: "venerdi",
    label: "Venerdì",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Mela", quantity: "150g" },
          { name: "Mandorle", quantity: "10g" },
          { name: "Latte", quantity: "150ml" },
          { name: "Biscotti", quantity: "40g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Parmigiano", quantity: "20g" },
          { name: "Gallette mais", quantity: "20g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Riso basmati", quantity: "50g" },
          { name: "Uovo", quantity: "50g" },
          { name: "Rucola", quantity: "80g" },
          { name: "Lattuga", quantity: "80g" },
          { name: "Peperone", quantity: "200g" },
          { name: "Olio", quantity: "10g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Fragole", quantity: "200g" },
          { name: "Nocciole", quantity: "10g" },
          { name: "Yogurt", quantity: "200g" },
        ],
      },
    ],
  },
  {
    day: "sabato",
    label: "Sabato",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Succo arancia", quantity: "200ml" },
          { name: "Sottilette", quantity: "20g" },
          { name: "Prosciutto", quantity: "70g" },
          { name: "Pane", quantity: "50g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Mandorle", quantity: "10g" },
          { name: "Albume", quantity: "100g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Patate", quantity: "150g" },
          { name: "Fagioli sc.", quantity: "200g" },
          { name: "Mozzarella", quantity: "50g" },
          { name: "Melanzane", quantity: "200g" },
          { name: "Pomodori", quantity: "150g" },
          { name: "Olio", quantity: "10g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Ciliegie", quantity: "150g" },
          { name: "Sgombro", quantity: "50g" },
          { name: "Pane", quantity: "30g" },
        ],
      },
    ],
  },
  {
    day: "domenica",
    label: "Domenica",
    meals: [
      {
        time: "colazione",
        label: "Colazione",
        foods: [
          { name: "Fragole", quantity: "150g" },
          { name: "Yogurt", quantity: "170g" },
          { name: "Biscotti", quantity: "40g" },
          { name: "Burro arachidi", quantity: "10g" },
          { name: "Caffè", quantity: "30ml" },
        ],
      },
      {
        time: "spuntino",
        label: "Spuntino",
        foods: [
          { name: "Pesca", quantity: "200g" },
          { name: "Parmigiano", quantity: "20g" },
        ],
      },
      {
        time: "pranzo",
        label: "Pranzo",
        foods: [
          { name: "Gnocchi", quantity: "150g" },
          { name: "Parmigiano", quantity: "20g" },
          { name: "Zucchine", quantity: "200g" },
          { name: "Olio", quantity: "10g" },
          { name: "Basilico", quantity: "2g" },
        ],
      },
      {
        time: "merenda",
        label: "Merenda",
        foods: [
          { name: "Gelato frutta", quantity: "150g" },
        ],
      },
    ],
  },
];

// JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
// WEEKLY_PLAN: 0=Lunedì, 1=Martedì, ..., 6=Domenica
export function getDayPlan(date: Date): DayPlan {
  const jsDay = date.getDay();
  const planIndex = (jsDay + 6) % 7;
  return WEEKLY_PLAN[planIndex];
}
