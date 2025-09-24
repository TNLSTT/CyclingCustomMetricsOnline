export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-3xl font-bold">Activity not found</h1>
      <p className="mt-2 text-muted-foreground">
        The requested resource could not be located. Try uploading a new ride.
      </p>
    </div>
  );
}
