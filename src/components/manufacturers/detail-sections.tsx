import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Phone,
  MessageCircle,
  ExternalLink,
  MapPin,
  Package,
  Activity,
  Tags,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotesSection } from "./notes-section";
import type {
  ManufacturerProfile,
  Product,
  Contact,
  Location,
  ManufacturerPage,
  LeadNote,
} from "@/db/schema";

interface DetailSectionsProps {
  leadId: number;
  profile: ManufacturerProfile & {
    products: Product[];
    contacts: Contact[];
    locations: Location[];
  };
  pages: ManufacturerPage[];
  notes: LeadNote[];
  leadUrl: string;
}

export function DetailSections({ profile, pages, notes, leadId, leadUrl }: DetailSectionsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
      {/* Main Column */}
      <div className="space-y-12 min-w-0">
        {/* Notes Section - Placed prominently at the top of the main column or below products */}
        <NotesSection leadId={leadId} notes={notes} />

        {/* Products Section */}
        <section id="products" className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-semibold text-zinc-900">Products & CAS</h2>
          </div>
          {profile.products.length > 0 ? (
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/50">
                    <TableHead className="w-[40%]">Chemical</TableHead>
                    <TableHead>CAS Number</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium text-zinc-900">
                        {product.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-zinc-600">
                        {product.casNumber || (
                          <span className="text-zinc-400 italic">No CAS</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {product.grade || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic py-4">
              No products were extracted for this manufacturer.
            </p>
          )}
        </section>

        {/* Locations Section */}
        <section id="locations" className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-semibold text-zinc-900">Locations</h2>
          </div>
          {profile.locations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.locations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-4 rounded-lg border border-zinc-200 bg-white space-y-2"
                >
                  <div className="font-medium text-zinc-900">
                    {loc.city && loc.state
                      ? `${loc.city}, ${loc.state}`
                      : loc.city || loc.state || "Location Detail"}
                  </div>
                  {loc.address && (
                    <div className="text-sm text-zinc-600 leading-relaxed">
                      {loc.address}
                    </div>
                  )}
                  <div className="text-xs text-zinc-400 uppercase tracking-wider">
                    {loc.country}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic py-4">
              No plant or office locations were extracted.
            </p>
          )}
        </section>

        {/* Source Coverage Section */}
        <section id="sources" className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-semibold text-zinc-900">Source Coverage</h2>
          </div>
          {pages.length > 0 ? (
            <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-200">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-3 group hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="capitalize font-normal bg-zinc-100 text-zinc-600 border-zinc-200"
                    >
                      {page.pageType}
                    </Badge>
                    <span className="text-sm text-zinc-600 truncate max-w-[300px] md:max-w-[500px]">
                      {page.url}
                    </span>
                  </div>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic py-4">
              No crawl pages are available for this manufacturer.
            </p>
          )}
        </section>
      </div>

      {/* Sticky Right Rail */}
      <aside className="lg:sticky lg:top-8 space-y-8">
        {/* Snapshot / Stats */}
        <div className="p-6 rounded-xl border border-zinc-200 bg-zinc-50 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-tight">
              Snapshot
            </h3>
            <p className="text-xs text-zinc-500">Key metrics from extraction</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-2xl font-semibold text-zinc-900">
                {profile.products.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-medium">
                Products
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-semibold text-zinc-900">
                {profile.locations.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-medium">
                Locations
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-semibold text-zinc-900">
                {profile.contacts.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-medium">
                Contacts
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-semibold text-zinc-900">
                {pages.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-medium">
                Sources
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase font-medium">
                Lead Source
              </span>
              <a
                href={leadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1"
              >
                {new URL(leadUrl).hostname}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Industries Served */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">
              Industries Served
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.industriesServed && profile.industriesServed.length > 0 ? (
              profile.industriesServed.map((industry) => (
                <Badge
                  key={industry}
                  variant="secondary"
                  className="bg-white border-zinc-200 text-zinc-700 font-normal"
                >
                  {industry}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-zinc-500 italic">
                No industries extracted
              </span>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Production Capacity</h3>
          </div>
          <div className="p-4 rounded-lg border border-zinc-200 bg-white">
            {profile.capacityMtPerYear ? (
              <div className="space-y-1">
                <div className="text-lg font-semibold text-zinc-900">
                  {profile.capacityMtPerYear.toLocaleString()} MT/year
                </div>
                {profile.capacityRawText && (
                  <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                    Source: {profile.capacityRawText}
                  </div>
                )}
              </div>
            ) : profile.capacityRawText ? (
              <div className="space-y-1">
                <div className="text-sm font-medium text-zinc-900">
                  {profile.capacityRawText}
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Raw extracted capacity
                </div>
              </div>
            ) : (
              <span className="text-sm text-zinc-500 italic">
                Capacity not extracted
              </span>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Contacts</h3>
          </div>
          <div className="space-y-2">
            {profile.contacts.length > 0 ? (
              profile.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 bg-white group hover:border-zinc-300 transition-colors"
                >
                  <div className="p-2 rounded bg-zinc-50 text-zinc-500 group-hover:text-blue-600 transition-colors">
                    {contact.type === "email" && <Mail className="w-4 h-4" />}
                    {contact.type === "phone" && <Phone className="w-4 h-4" />}
                    {contact.type === "whatsapp" && (
                      <MessageCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-400 uppercase font-medium tracking-tight">
                      {contact.type}
                    </p>
                    <a
                      href={
                        contact.type === "email"
                          ? `mailto:${contact.value}`
                          : contact.type === "phone" || contact.type === "whatsapp"
                          ? `tel:${contact.value}`
                          : "#"
                      }
                      className="text-sm font-medium text-zinc-900 hover:text-blue-600 transition-colors truncate block"
                    >
                      {contact.value}
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No verified contact details were extracted.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
