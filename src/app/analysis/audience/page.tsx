import { AnalysisView } from '../AnalysisView';

type AudienceAnalysisPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AudienceAnalysisPage({
  searchParams,
}: AudienceAnalysisPageProps) {
  const params = searchParams ? await searchParams : {};
  const showParam = params.show;
  const initialShowSummaries = Array.isArray(showParam)
    ? showParam.includes('1')
    : showParam === '1';

  return <AnalysisView mode="audience" initialShowSummaries={initialShowSummaries} />;
}
