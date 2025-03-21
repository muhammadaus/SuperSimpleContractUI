import React from 'react';

// Mock implementations of scaffold-eth components

export const Address = ({ address }: { address: string }) => {
  return (
    <span className="text-base font-medium">
      {address?.slice(0, 6)}...{address?.slice(-4)}
    </span>
  );
};

export const Balance = ({ address }: { address: string }) => {
  return <span className="text-base font-medium">0.0 ETH</span>;
};

export const AddressInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Address (0x...)"
      className="input input-bordered"
    />
  );
};

export const IntegerInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className="input input-bordered"
    />
  );
};

export const InputBase = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input input-bordered"
    />
  );
};

export const Bytes32Input = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0x..."
      className="input input-bordered"
    />
  );
};

export const BytesInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0x..."
      className="input input-bordered"
    />
  );
};

export const StringInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input input-bordered"
    />
  );
}; 