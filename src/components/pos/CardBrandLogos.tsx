import React from 'react';

export const VisaLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 750 471" xmlns="http://www.w3.org/2000/svg">
    <path fill="#1A1F71" d="M278.198 334.228L313.295 131.524H364.89L329.793 334.228H278.198Z"/>
    <path fill="#1A1F71" d="M524.307 138.046C513.958 134.028 497.389 129.772 476.609 129.772C425.537 129.772 390.114 155.68 389.782 193.12C389.451 220.692 416.101 236.01 436.217 245.115C456.754 254.443 463.681 260.425 463.597 268.924C463.432 282.005 447.089 287.821 431.819 287.821C410.503 287.821 399.143 284.823 381.474 277.084L374.632 273.925L367.123 319.063C379.774 324.413 402.954 329.093 427.006 329.341C481.417 329.341 516.177 303.749 516.592 263.776C516.84 241.682 502.755 224.774 472.273 210.853C453.539 201.998 441.982 195.849 442.15 186.743C442.15 178.576 451.879 169.885 472.773 169.885C490.029 169.553 502.671 173.489 512.603 177.507L517.437 179.8L524.307 138.046Z"/>
    <path fill="#1A1F71" d="M661.605 131.524H622.436C611.177 131.524 602.678 134.523 597.678 145.948L520.891 334.228H575.219L586.331 304.166H652.854L659.367 334.228H707.519L661.605 131.524ZM601.593 265.274C605.593 254.859 623.598 207.355 623.598 207.355C623.266 207.853 627.514 196.109 629.976 188.855L633.31 205.686C633.31 205.686 644.589 258.547 647.006 265.274H601.593Z"/>
    <path fill="#1A1F71" d="M232.196 131.524L181.705 262.607L176.291 236.093C166.858 204.686 137.312 170.632 104.535 153.722L150.533 334.062H205.361L287.108 131.524H232.196Z"/>
    <path fill="#F7B600" d="M131.92 131.524H48.898L48.233 135.273C113.878 151.302 157.787 190.852 176.291 236.093L157.456 145.865C154.206 134.772 145.54 131.857 131.92 131.524Z"/>
  </svg>
);

export const MastercardLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 131.39 86.9" xmlns="http://www.w3.org/2000/svg">
    <rect fill="#ff5f00" x="48.37" y="15.14" width="34.66" height="56.61"/>
    <path fill="#eb001b" d="M51.94,43.45a35.94,35.94,0,0,1,13.75-28.3,36,36,0,1,0,0,56.61A35.94,35.94,0,0,1,51.94,43.45Z"/>
    <path fill="#f79e1b" d="M120.5,65.76V64.6h.47v-.24h-1.19v.24h.47v1.16Zm2.31,0V64.36h-.36l-.42,1-.42-1h-.36v1.4h.26V64.7l.39.91h.27l.39-.91v1.06Z"/>
    <path fill="#f79e1b" d="M123.94,43.45a36,36,0,0,1-58.25,28.3,36,36,0,0,0,0-56.61,36,36,0,0,1,58.25,28.3Z"/>
  </svg>
);

export const EloLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
    <rect fill="#000" width="200" height="80" rx="8"/>
    <text x="100" y="52" fill="#FFCB05" fontFamily="Arial, sans-serif" fontSize="40" fontWeight="bold" textAnchor="middle">elo</text>
  </svg>
);

export const AmexLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 750 471" xmlns="http://www.w3.org/2000/svg">
    <path fill="#006FCF" d="M0,40.004C0,17.909,17.909,0,40.004,0H710c22.09,0,40,17.909,40,40.004V430.996C750,453.091,732.09,471,710,471H40.004C17.909,471,0,453.091,0,430.996V40.004z"/>
    <path fill="#FFF" d="M124.719,235.5l-11.631-27.9l-11.631,27.9H124.719z M304.5,262.5h-53.1l-25.425-27.9l-26.1,27.9h-76.05l-11.475-27.45H85.5l-11.25,27.45H30.375l51.3-111.15h42.525l48.45,102.6V151.35h46.575l40.725,86.175l37.35-86.175h47.7V262.5H304.5z"/>
  </svg>
);

export const CardBrandIcon = ({ brand, className }: { brand: string; className?: string }) => {
  switch (brand) {
    case 'visa':
      return <VisaLogo className={className} />;
    case 'mastercard':
      return <MastercardLogo className={className} />;
    case 'elo':
      return <EloLogo className={className} />;
    case 'amex':
      return <AmexLogo className={className} />;
    default:
      return null;
  }
};
