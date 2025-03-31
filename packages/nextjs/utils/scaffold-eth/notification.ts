/**
 * Simple notification utility for displaying messages to the user.
 * This is a simplified version that logs to console instead of showing UI toasts.
 */

export const notification = {
  /**
   * Show a success message
   */
  success: (message: string) => {
    console.log(`✅ SUCCESS: ${message}`);
    // In a real app, you would show a toast notification
    if (typeof window !== 'undefined') {
      alert(`Success: ${message}`);
    }
  },

  /**
   * Show an error message
   */
  error: (message: string) => {
    console.error(`❌ ERROR: ${message}`);
    // In a real app, you would show a toast notification
    if (typeof window !== 'undefined') {
      alert(`Error: ${message}`);
    }
  },

  /**
   * Show an info message
   */
  info: (message: string) => {
    console.info(`ℹ️ INFO: ${message}`);
    // In a real app, you would show a toast notification
  },

  /**
   * Show a loading message
   */
  loading: (message: string) => {
    console.log(`⏳ LOADING: ${message}`);
    // In a real app, you would show a toast notification
    // Return an ID that can be used to remove the notification
    return Date.now().toString();
  },

  /**
   * Remove a notification by ID
   */
  remove: (id: string) => {
    console.log(`🗑️ REMOVED NOTIFICATION: ${id}`);
    // In a real app, you would remove the toast notification
  }
};

/**
 * Hook to access notification functions in components
 */
export const useNotification = () => {
  return notification;
}; 