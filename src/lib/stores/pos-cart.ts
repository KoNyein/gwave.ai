import { create } from "zustand";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  /** Absolute line discount in store currency. */
  discount: number;
}

interface PosCartState {
  lines: CartLine[];
  cartDiscount: number;
  customerId: string | null;
  addProduct: (product: {
    id: string;
    name: string;
    price: number;
  }) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setLineDiscount: (productId: string, discount: number) => void;
  removeLine: (productId: string) => void;
  setCartDiscount: (discount: number) => void;
  setCustomer: (customerId: string | null) => void;
  clear: () => void;
}

/**
 * In-memory cart (deliberately NOT persisted to storage — survives
 * re-renders and route changes within the session, per the phase plan).
 */
export const usePosCart = create<PosCartState>((set) => ({
  lines: [],
  cartDiscount: 0,
  customerId: null,

  addProduct: (product) =>
    set((state) => {
      const existing = state.lines.find(
        (line) => line.productId === product.id,
      );
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            discount: 0,
          },
        ],
      };
    }),

  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.productId !== productId)
          : state.lines.map((line) =>
              line.productId === productId ? { ...line, quantity } : line,
            ),
    })),

  setLineDiscount: (productId, discount) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.productId === productId
          ? { ...line, discount: Math.max(0, discount) }
          : line,
      ),
    })),

  removeLine: (productId) =>
    set((state) => ({
      lines: state.lines.filter((line) => line.productId !== productId),
    })),

  setCartDiscount: (discount) => set({ cartDiscount: Math.max(0, discount) }),
  setCustomer: (customerId) => set({ customerId }),
  clear: () => set({ lines: [], cartDiscount: 0, customerId: null }),
}));

export function lineTotal(line: CartLine): number {
  return Math.max(0, line.price * line.quantity - line.discount);
}

export function cartSubtotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + lineTotal(line), 0) * 100) / 100;
}
