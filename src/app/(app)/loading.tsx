// Shown instantly while the next page loads, so taps feel immediate.
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 64, maxWidth: 320 }} />
      <div className="skel" style={{ height: 180 }} />
      <div className="skel" style={{ height: 260 }} />
    </>
  )
}
