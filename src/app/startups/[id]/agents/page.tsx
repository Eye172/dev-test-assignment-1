import { redirect } from "next/navigation";
export default async function AgentsAlias({params}:{params:Promise<{id:string}>}) { const {id}=await params;redirect(`/startups/${id}/ai`); }
