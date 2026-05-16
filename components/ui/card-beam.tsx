import { BorderBeam } from "@/components/ui/border-beam";

/**
 * Feixe de borda revelado no hover. Requer que o Card pai tenha
 * as classes: `group relative overflow-hidden`.
 */
export function CardBeam() {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
      <BorderBeam
        size={70}
        duration={5}
        borderWidth={2}
        colorFrom="#3fb5a3"
        colorTo="#4f7c93"
      />
      <BorderBeam
        size={70}
        duration={5}
        delay={2.5}
        borderWidth={2}
        colorFrom="#92b8c4"
        colorTo="#2b4954"
      />
    </div>
  );
}
