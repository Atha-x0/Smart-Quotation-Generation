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
        <section className="panel">
            <h2>Client Details</h2>

            <div className="form-grid">
                <label>
                    Company Name
                    <input
                        type="text"
                        value={client.companyName}
                        onChange={(event) => updateField("companyName", event.target.value)}
                        placeholder="ABC Industries Pvt. Ltd."
                    />
                </label>

                <label>
                    Location
                    <input
                        type="text"
                        value={client.location || ""}
                        onChange={(event) => updateField("location", event.target.value)}
                        placeholder="Nagpur, Maharashtra"
                    />
                </label>

                <label>
                    Industry Type
                    <input
                        type="text"
                        value={client.industryType || ""}
                        onChange={(event) => updateField("industryType", event.target.value)}
                        placeholder="Plastic Manufacturing"
                    />
                </label>

                <label>
                    DISCOM
                    <input
                        type="text"
                        value={client.discom || ""}
                        onChange={(event) => updateField("discom", event.target.value)}
                        placeholder="MSEDCL"
                    />
                </label>

                <label>
                    Tariff Category
                    <input
                        type="text"
                        value={client.tariffCategory || ""}
                        onChange={(event) => updateField("tariffCategory", event.target.value)}
                        placeholder="HT Industrial"
                    />
                </label>

                <label>
                    Contact Person
                    <input
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