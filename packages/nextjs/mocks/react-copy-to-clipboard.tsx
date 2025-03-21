import React from 'react';

// Mock implementation of react-copy-to-clipboard
interface CopyToClipboardProps {
  text: string;
  onCopy?: (text: string, result: boolean) => void;
  children: React.ReactNode;
}

export const CopyToClipboard: React.FC<CopyToClipboardProps> = ({ text, onCopy, children }) => {
  const handleClick = () => {
    // Mock copy functionality
    try {
      navigator.clipboard.writeText(text).then(() => {
        if (onCopy) onCopy(text, true);
      });
    } catch (error) {
      console.error('Could not copy text: ', error);
      if (onCopy) onCopy(text, false);
    }
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
};

export default CopyToClipboard; 