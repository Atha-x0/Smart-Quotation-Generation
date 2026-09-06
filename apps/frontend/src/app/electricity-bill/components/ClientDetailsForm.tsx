import type { ClientDetails } from "../types/billTypes";

interface ClientDetailsFormProps {
    client: ClientDetails;
    onChange: (client: ClientDetails) => void;
}

function ClientDetailsForm({ client, onChange }: ClientDetailsFormProps) {
    function updateField(field: keyof ClientDetails, value: string) {
        onChange({
            ...client,
            [field]: value,
        });
    }

    return (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Client Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Company Name
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.companyName}
                        onChange={(event) => updateField("companyName", event.target.value)}
                        placeholder="ABC Industries Pvt. Ltd."
                    />
                </label>

                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Location
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.location || ""}
                        onChange={(event) => updateField("location", event.target.value)}
                        placeholder="Nagpur, Maharashtra"
                    />
                </label>

                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Industry Type
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.industryType || ""}
                        onChange={(event) => updateField("industryType", event.target.value)}
                        placeholder="Plastic Manufacturing"
                    />
                </label>

                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    DISCOM
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.discom || ""}
                        onChange={(event) => updateField("discom", event.target.value)}
                        placeholder="MSEDCL"
                    />
                </label>

                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tariff Category
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.tariffCategory || ""}
                        onChange={(event) => updateField("tariffCategory", event.target.value)}
                        placeholder="HT Industrial"
                    />
                </label>

                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Contact Person
                    <input
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white shadow-inner transition-colors"
                        type="text"
                        value={client.contactPerson || ""}
                        onChange={(event) => updateField("contactPerson", event.target.value)}
                        placeholder="Plant Head"
                    />
                </label>
            </div>
        </section>
    );
}

export default ClientDetailsForm;