export function MWBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none flex items-center justify-center opacity-[0.03]">
            <svg
                viewBox="0 0 400 300"
                fill="currentColor"
                className="w-[150vw] h-[150vw] text-white opacity-100"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* 
                   Geometric MW Monogram Construction 
                   M: Two vertical pillars, connected by a V in the middle.
                   W: Similar but inverted? Or just M W side by side?
                   User said "MW block letters". Often intertwined or adjacent.
                   Let's do a sharp, angular, blocky M W.
                */}
                <path
                    d="M50 250 V50 L125 150 L200 50 V250 H160 V120 L125 170 L90 120 V250 Z"
                    fill="currentColor"
                />
                <path
                    d="M220 50 V250 L295 150 L370 250 V50 H330 V180 L295 130 L260 180 V50 Z"
                    fill="currentColor"
                />
            </svg>
        </div>
    )
}
