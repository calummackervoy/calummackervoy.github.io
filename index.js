
var activeTag = "";

//function toggles whether tag is active and applies filter
function selectTag(tag) {
    //update list of tags to reflect which is active
    activateTag(tag);

    activeTag = tag;

    //display results
    filter();
}

//function updates appearance of a tag in the list
function activateTag(tag) {
    //clear all tags in list of tag-active class
    var items = document.getElementsByClassName('tag-item');
    for(var i=0; i < items.length; i++) {
        items[i].classList.remove("tag-active");
    }

    // set the selected tag's item to active
    var item = document.getElementById(tag + '-item');
    if(item) {
        item.classList.add("tag-active");
    }
}

//function applies filters to projects, hiding any deselected
function filter() {
    
}