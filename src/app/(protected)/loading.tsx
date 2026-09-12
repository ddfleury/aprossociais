export default function Loading() {
  return (
    <div className="grid cols-3" aria-label="Carregando">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
