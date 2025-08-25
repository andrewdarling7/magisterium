
var coll = document.getElementsByClassName("footnumber");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function () {
    this.classList.toggle("active"); var content = this.nextElementSibling; if (content.style.display === "block") { content.style.display = "none"; } else { content.style.display = "block"; }
  });
}

let mybutton = document.getElementById("myBtn");

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function () { scrollFunction() };

function scrollFunction() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    mybutton.style.display = "block";
  } else {
    mybutton.style.display = "none";
  }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}





var coll = document.getElementsByClassName("collapsible");
  var i;

  for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
      this.classList.toggle("active"); var content = this.nextElementSibling; if (content.style.display === "block") { content.style.display = "none"; } else { content.style.display = "block"; }
    });
  }


  // If you want a button that toggles show/hide all:
  var toggleBtn = document.querySelector(".showall");
  toggleBtn.addEventListener("click", function () {
    var allColl = document.getElementsByClassName("collapsible");
    var anyClosed = false;
    // Check if any are closed
    for (var i = 0; i < allColl.length; i++) {
      if (!allColl[i].classList.contains("active")) { anyClosed = true; break; }
    }
    // If any are closed, open all; else, close all
    for (var i = 0; i < allColl.length; i++) {
      var btn = allColl[i]; var content = btn.nextElementSibling; if (anyClosed) { btn.classList.add("active"); content.style.display = "block"; } else { btn.classList.remove("active"); content.style.display = "none"; }
    }
  });


document.getElementById('toggle-english').addEventListener('change', function() {
  toggleColumn('english', this.checked);
});

document.getElementById('toggle-latin').addEventListener('change', function() {
  toggleColumn('latin', this.checked);
});

function toggleColumn(className, show) {
  var cells = document.getElementsByClassName(className);
  for (var i = 0; i < cells.length; i++) {
    if (show) {
      cells[i].classList.remove('hide-column');
    } else {
      cells[i].classList.add('hide-column');
    }
  }
}









