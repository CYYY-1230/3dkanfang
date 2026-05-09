import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";

export function PropertyCard({
  property,
  priority = false,
}: {
  property: Property;
  priority?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-ink/10 bg-[#fffcf7]/82 shadow-soft">
      <div className="relative aspect-[16/9]">
        <Image
          src={property.coverImage}
          alt={`${property.name}楼盘示意图`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 420px"
          priority={priority}
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{property.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink/58">
              <MapPin size={15} />
              {property.city} · {property.district}
            </p>
          </div>
          <span className="rounded-md bg-[#f6ebd8] px-3 py-1 text-sm font-bold text-[#6f4717]">
            {property.priceRange}
          </span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink/65">
          {property.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {property.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-ink/10 bg-pearl px-2.5 py-1 text-xs font-semibold text-ink/65"
            >
              {tag}
            </span>
          ))}
        </div>
        <Link
          href={`/properties/${property.id}`}
          className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0b4b41]"
        >
          查看楼盘
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
