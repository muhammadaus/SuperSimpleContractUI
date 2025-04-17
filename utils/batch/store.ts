import { create } from 'zustand'

// Define the type for a batch operation
export interface BatchOperation {
  to: string
  data: string
  value: string
}

// Define the type for our batch store state
interface BatchState {
  operations: BatchOperation[]
  loading: boolean
  addOperation: (operation: BatchOperation) => void
  clearOperations: () => void
  setLoading: (loading: boolean) => void
}

// Create the store
export const useBatchStore = create<BatchState>((set) => ({
  operations: [],
  loading: false,
  
  // Add a new operation to the batch
  addOperation: (operation: BatchOperation) => 
    set((state) => ({ operations: [...state.operations, operation] })),
  
  // Clear all operations
  clearOperations: () => set({ operations: [] }),
  
  // Set the loading state
  setLoading: (loading: boolean) => set({ loading })
})) 