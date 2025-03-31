import React, { useState, useEffect } from 'react';
import { AbiFunction, AbiParameter } from 'abitype';
import { ethers } from 'ethers';

interface FunctionFormProps {
  functionDetails: AbiFunction;
  onSubmit: (functionName: string, args: any[]) => void;
  onEtherValueChange?: (value: string) => void;
}

export const FunctionForm = ({ functionDetails, onSubmit, onEtherValueChange }: FunctionFormProps) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [etherValue, setEtherValue] = useState<string>('');
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});

  // Reset inputs when function changes
  useEffect(() => {
    setInputs({});
    setInputErrors({});
    setEtherValue('');
    if (onEtherValueChange) {
      onEtherValueChange('');
    }
  }, [functionDetails, onEtherValueChange]);

  // Validate inputs before submission
  const validateInputs = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    functionDetails.inputs.forEach((input, index) => {
      const inputName = input.name || `input_${index}`;
      const value = inputs[inputName] || '';

      // Required check
      if (value.trim() === '') {
        if (input.type !== 'bool') { // Booleans can be empty (interpreted as false)
          errors[inputName] = 'This field is required';
          isValid = false;
          return;
        }
      }

      // Type-specific validation
      if (value.trim() !== '') {
        if (input.type.includes('int')) {
          try {
            // For integer types
            if (value.includes('.')) {
              errors[inputName] = 'Must be a whole number';
              isValid = false;
            } else {
              // This will throw if the value is not a valid number
              BigInt(value);
            }
          } catch {
            errors[inputName] = 'Invalid number format';
            isValid = false;
          }
        } else if (input.type === 'address') {
          if (!ethers.isAddress(value)) {
            errors[inputName] = 'Invalid address format';
            isValid = false;
          }
        } else if (input.type === 'bool') {
          if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0' && value !== '') {
            errors[inputName] = 'Must be true or false';
            isValid = false;
          }
        }
      }
    });

    // Validate ETH value if function is payable
    if (functionDetails.stateMutability === 'payable' && etherValue) {
      try {
        if (Number(etherValue) < 0) {
          errors['etherValue'] = 'Value cannot be negative';
          isValid = false;
        }
      } catch {
        errors['etherValue'] = 'Invalid ETH value';
        isValid = false;
      }
    }

    setInputErrors(errors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      return;
    }

    const args = functionDetails.inputs.map((input, index) => {
      const inputName = input.name || `input_${index}`;
      const value = inputs[inputName] || '';

      if (value === '') {
        // Default values for empty inputs
        if (input.type === 'bool') return false;
        if (input.type.includes('int')) return 0;
        if (input.type === 'address') return ethers.ZeroAddress;
        if (input.type === 'string') return '';
        if (input.type.includes('[]')) return [];
        return null;
      }

      // Type conversions
      if (input.type.includes('int')) {
        try {
          return BigInt(value);
        } catch {
          return 0;
        }
      } else if (input.type === 'bool') {
        return value === 'true' || value === '1';
      } else if (input.type.includes('[]')) {
        try {
          // Try to parse as JSON
          return JSON.parse(value);
        } catch {
          // If not valid JSON, split by comma
          return value.split(',').map(item => item.trim());
        }
      }

      // Return as is for other types
      return value;
    });

    // Update ETH value if function is payable
    if (functionDetails.stateMutability === 'payable' && onEtherValueChange) {
      onEtherValueChange(etherValue);
    }

    onSubmit(functionDetails.name || '', args);
  };

  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (inputErrors[name]) {
      setInputErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleEtherValueChange = (value: string) => {
    setEtherValue(value);
    if (onEtherValueChange) {
      onEtherValueChange(value);
    }
    // Clear error when user types
    if (inputErrors['etherValue']) {
      setInputErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['etherValue'];
        return newErrors;
      });
    }
  };

  // Render a form input based on the ABI parameter type
  const renderInput = (input: AbiParameter, index: number) => {
    const inputName = input.name || `input_${index}`;
    const error = inputErrors[inputName];
    
    return (
      <div key={index} className="mb-3">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {inputName}
          <span className="ml-1 text-xs text-gray-400">({input.type})</span>
        </label>
        
        {input.type === 'bool' ? (
          <select
            value={inputs[inputName] || ''}
            onChange={(e) => handleInputChange(inputName, e.target.value)}
            className={`w-full p-2 rounded-md bg-gray-700 text-white ${
              error ? 'border border-red-500' : ''
            }`}
          >
            <option value="">Select...</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={input.type.includes('int') ? 'text' : 'text'}
            value={inputs[inputName] || ''}
            onChange={(e) => handleInputChange(inputName, e.target.value)}
            placeholder={`Enter ${input.type} value`}
            className={`w-full p-2 rounded-md bg-gray-700 text-white ${
              error ? 'border border-red-500' : ''
            }`}
          />
        )}
        
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-1">
        {functionDetails.inputs.map((input, index) => renderInput(input, index))}
        
        {functionDetails.stateMutability === 'payable' && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Value (ETH)
            </label>
            <input
              type="text"
              value={etherValue}
              onChange={(e) => handleEtherValueChange(e.target.value)}
              placeholder="0.0"
              className={`w-full p-2 rounded-md bg-gray-700 text-white ${
                inputErrors['etherValue'] ? 'border border-red-500' : ''
              }`}
            />
            {inputErrors['etherValue'] && (
              <p className="text-red-500 text-xs mt-1">{inputErrors['etherValue']}</p>
            )}
          </div>
        )}
      </div>
      
      <button
        type="submit"
        className="mt-3 w-full py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
      >
        Execute
      </button>
    </form>
  );
}; 