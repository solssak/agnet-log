export const BackgroundGradient = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0 w-full"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.1) 40%, transparent 70%), radial-gradient(circle, rgba(20, 184, 166, 0.2) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 20px 20px",
        }}
      ></div>
    </div>
  );
};
