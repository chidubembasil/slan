export default function Footer(){
  return (
    <footer className="w-full border-t border-border bg-card p-6 mt-8">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} SLAN — All rights reserved.</div>
        <div className="flex gap-4 items-center">
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#">Privacy</a>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#">Terms</a>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#">Help</a>
        </div>
      </div>
    </footer>
  )
}
