"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, PencilIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

const PlayIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M4.018 14L14.41 9.9a1 1 0 0 0 0-1.8L4.018 4" />
  </svg>
);

const isActive = (pathname: string, href: string) => pathname === href;

const baseLink = `hover:bg-gray-800 hover:shadow-lg transition-all duration-200
  py-1.5 px-3 text-sm rounded-xl gap-2 grid grid-flow-col
  text-gray-300 hover:text-white`;

const activeLink = `bg-gray-800 shadow-lg ${baseLink}`;

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "ReadWrite Contracts",
    href: "/readwrite",
    icon: <PencilIcon className="h-4 w-4" />,
  },
  {
    label: "ERC20",
    href: "/erc20",
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <nav>
      <ul>
        {menuLinks.map(({ label, href, icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                passHref
                className={active ? activeLink : baseLink}
              >
                {icon}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const burgerMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useOutsideClick(
    burgerMenuRef,
    useCallback(() => setIsDrawerOpen(false), []),
  );

  return (
    <div className="sticky lg:static top-0 navbar min-h-0 flex-shrink-0 justify-between z-20 px-0 sm:px-2
      bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
      <div className="navbar-start w-auto lg:w-1/2">
        <div className="lg:hidden dropdown" ref={burgerMenuRef}>
          <label
            tabIndex={0}
            className={`ml-1 p-2 hover:bg-gray-800 rounded-xl transition-colors duration-200 ${
              isDrawerOpen ? "bg-gray-800" : ""
            }`}
            onClick={() => {
              setIsDrawerOpen(prevIsOpenState => !prevIsOpenState);
            }}
          >
            <Bars3Icon className="h-1/2 text-gray-300" />
          </label>
          {isDrawerOpen && (
            <ul
              tabIndex={0}
              className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg
                bg-gray-900 border border-gray-800 rounded-xl w-52"
              onClick={() => {
                setIsDrawerOpen(false);
              }}
            >
              <HeaderMenuLinks />
            </ul>
          )}
        </div>
        <Link href="/" passHref className="hidden lg:flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="flex relative w-10 h-10">
          </div>
          <div className="flex flex-col">
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-2">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end flex-grow mr-4 flex items-center justify-center gap-2">
        <button
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 
            hover:from-blue-600 hover:to-purple-600 text-white font-normal gap-1 
            transition-all duration-200"
          onClick={() => setIsVideoModalOpen(true)}
        >
          <PlayIcon className="h-4 w-4 inline-block mr-1" />
          <span>Watch Tutorial</span>
        </button>

        {isVideoModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center">
            <div className="bg-gray-900 p-4 rounded-xl max-w-xl w-full border border-gray-800">
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => setIsVideoModalOpen(false)} 
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Close
                </button>
              </div>
              <div className="aspect-w-16 aspect-h-9">
                <iframe
                  className="w-full h-full rounded-lg"
                  src="https://www.youtube.com/embed/rxeLJsmHBlc?autoplay=1"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}
        
        <RainbowKitCustomConnectButton />
        <FaucetButton />
      </div>
    </div>
  );
};
