import Image from 'next/image'

export function MWBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
            {/* Gradient Background Base */}
            <div className="absolute inset-0 bg-gradient-to-br from-black via-[#051005] to-black z-0" />

            {/* Asset 3 SVG - Increased visibility */}
            {/* SVG is dark grey #333. Invert makes it light grey #CCC. 
                Opacity 0.15 makes it subtle but visible against black. 
                mix-blend-screen helps it glow on top of the dark gradients. */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.2] invert mix-blend-screen scale-[1.5] animate-pulse-slow">
                <Image
                    src="/asset-3.svg"
                    alt=""
                    width={800}
                    height={600}
                    className="w-full h-full object-cover opacity-80"
                    priority
                />
            </div>

            {/* Texture Layer - Subtle grain */}
            <div className="absolute inset-0 opacity-[0.1] bg-[url('/asset-3.svg')] bg-repeat bg-[length:200px_auto] mix-blend-overlay invert scale-110" />

            {/* Vignette & Color Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/90 z-10" />
            <div className="absolute inset-0 bg-green-500/5 mix-blend-screen z-10" />

            {/* Radial Spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] z-20" />
        </div>
    )
}
