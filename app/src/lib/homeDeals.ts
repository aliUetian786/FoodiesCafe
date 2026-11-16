/**
 * Homepage deal combos (MarketingHome "Deals" grid).
 * Shared by the customer UI and the server-side order price recalculation so that
 * deal orders are accepted and always charged the authoritative server price.
 */
export interface HomeDeal {
  id: string;
  title: string;
  tag: string;
  description: string;
  price: number;
}

export const HOME_DEALS: HomeDeal[] = [
  {
    id: 'deal-home-1',
    title: 'Family Dum Biryani Feast (Deal for 3-4)',
    tag: 'CHEF SPECIAL DEAL',
    description: '2x Royal Chicken Biryani, 1x Half Chicken Boti BBQ, 2x Mint Margaritas, Raita & Salad.',
    price: 1650,
  },
  {
    id: 'deal-home-2',
    title: 'Shinwari Karahi Duo Combo (Deal for 2)',
    tag: 'HOT COMBO',
    description: 'Half Desi Ghee Shinwari Chicken Karahi, 4x Fresh Roghni Naan, 2x Soft Drinks & Mint Chutney.',
    price: 1550,
  },
  {
    id: 'deal-home-3',
    title: 'Smashed Burger & Fries Crave Deal',
    tag: 'FAST FOOD DEAL',
    description: '1x Double Beef Smashed Cheeseburger, 1x Peri Peri Loaded Fries & 1x Artisanal Mint Margarita.',
    price: 1190,
  },
  {
    id: 'deal-home-4',
    title: 'Midnight BBQ Feast Deal',
    tag: 'BBQ SPECIAL',
    description: '4 pcs Reshmi Chicken Kebabs, 6 pcs Chicken Malai Boti, 2x Garlic Butter Naans, Raita & Salad.',
    price: 1290,
  },
];

export function getHomeDealById(id?: string | null): HomeDeal | undefined {
  if (!id) return undefined;
  return HOME_DEALS.find((d) => d.id === id);
}
