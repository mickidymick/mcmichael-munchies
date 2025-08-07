document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.querySelector(".hamburger");
    const navLinks = document.querySelector(".nav-links");

    if (hamburger && navLinks) {
        hamburger.addEventListener("click", () => {
            navLinks.classList.toggle("show");
        });
    }

    const dropdowns = document.querySelectorAll(".dropdown .dropbtn");
    dropdowns.forEach((btn) =>
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            const parent = this.parentElement;
            parent.classList.toggle("open");
        })
    );
});
